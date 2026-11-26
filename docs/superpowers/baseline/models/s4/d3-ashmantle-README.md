# D3: Ashmantle, its own body on the dragon skeleton

Built with `BLEND(monsters)` on Blender 5.0.1 (`build_ashmantle` in `scripts/blender/build_monsters.py`). `Monster_ashmantle` stands at the file's origin, skinned on the dragon table with bones `ashmantle_<Bone>` at the dragon's own joints (`dragon_joints()`, unchanged), because the dragon's clips carry an absolute `Hips` track and the dragon-skeleton path does not rescale it. It has no clips of its own. Everything that tells it from the dragon is mesh and paint.

## What it is (design 5.6)

- **Heavier chest**: the dragon's stick graph with the chest and withers radii times 1.28 and 1.26, the waist 1.06, the neck base 1.12, and a deep brisket node (0.56 by 0.60) hanging between the fore legs.
- **Slag crown** fused to the skull in place of the swept horns: seven blunt faceted crags rooted inside the skull, tallest at the back.
- **Back plates with glowing seams**: ten flat slabs of pale crust in pairs, leaning apart, over a core on `mat_glow_orange` that stands 0.08 taller, so the seam glows along each crest and between the halves.
- **Clubbed tail**: a faceted knot of slag (0.40 by 0.34 by 0.44) with six blunt knobs on `TailPivot3`.
- Wings, membranes, fangs, tusks and claws on the dragon's pattern. The eyes are ember slits on the glow mesh, the maw glows as the dragon's does.
- Four skinned meshes, one per engine family: `ashmantle_body` (skin, the dragon-scale tile: hide and belly), `ashmantle_membrane` (leather), `ashmantle_crust` (plain: crown, plates, club, claws, fangs, and the feet, wing wrists and wing struts), `ashmantle_embers` (glow). The feet are the body's foot faces (the dragon's foot rule, a face centre under 0.16) split off into the crust mesh by `_ashmantle_feet`, with their skin weights. Three white materials of its own (`mat_skin_ashmantle_paint`, `mat_wing_ashmantle_paint`, `mat_horn_ashmantle_paint`); no mesh name holds `eye`.

## Values against the dragon's

The engine multiplies Stage 4's `tint` (0x8a8580) into every material except the glow, after the tile. Each paint is therefore the colour wanted in the game divided by the tile's mean and by the tint (`_ashmantle_paint`). Under the tint the scale-tiled skin can reach about 40% at most, so a part can be 15 points lighter than the dragon's only on the plain crust material (no tile), whose top is 48%. The hide, belly and membrane go darker; the feet, wing wrists and struts go lighter, in the pale slag of the crown. No part is painted under design 5.4's 18% floor.

| Part | Dragon (`DRAGON_COLOURS`) | Ashmantle (`ASHMANTLE_COLOURS`) | Gap on paint | Plane tone (shade, lit) |
|---|---|---|---|---|
| Hide | 0x3F6139, 38% | 0x2E2B28, 18% (the floor) | 20 darker | wide, (-0.40, +0.85) |
| Feet, wing wrists and struts | 0x2E4A2E, 29% | 0x7A756E, 48%, on the crust | 19 lighter | narrow, (-0.25, +0.30) |
| Membrane | 0x80402E, 50% | 0x3A2A24, 23% | 27 darker | wide |
| Belly | 0x9E8748, 62% | 0x5A534B, 35% | 27 darker | narrow |
| Horn / crust | 0xB8AD90, 72% | 0x7A756E, 48% | 24 darker | narrow |
| Glow | `mat_glow_orange` (maw) | `mat_glow_orange` (maw, eyes, seams) | | |

The plane tone is a vertex-colour factor. Each carved plane takes it from its normal measured against the key light (`_goblin_plane_tones`). The goblin and the dragon use (-0.25, +0.15). On a hide this dark that narrow tone read as one black mass in the game, so the hide and membrane take a wide tone: a plane facing the light is painted up to 1.85 times as light. Belly and crust (now with the feet and struts) keep a narrow tone, because their paint is at the top of what the tint leaves; `_ashmantle_paint` refuses any paint that the lit tone would push over 1.

History: the first build painted the feet and struts at 13% on the skin; the first repair raised them to the 18% floor, 11 points from the dragon's 29%. This repair moves them to the crust at 48%, 19 points the other way. Floor and gap now both hold for every part.

### Measured in the game, like for like

**Setup.** A throw-away worktree of this branch under `scratch/` with the built `monsters.glb`, the pending manifest, `body: 'ashmantle'`, the staged dragon clips on the live dragon row, and a capture patch (`__DEBUG` exposes `THREE`, `G` and `getTerrainHeight`; `updateMonsters` skips a monster with `__tick` set). `vite build` and `vite preview`, the NVIDIA GPU (`scripts/capture-gpu.mjs`), `balanced`, noon (`phase(0.5)`), clear weather. Every monster is frozen; the hero and every other monster are hidden. Each figure in turn stands on Ashmantle's own spot with Ashmantle's heading, the other hidden, frozen in its bind pose (clips stopped, `skeleton.pose()`). Three cameras on that spot at distance 26: a (yaw 0.6, pitch 0.4), b (yaw 0.3, pitch 0.6), c (yaw 0.9, pitch 0.6).

**Method.** Each frame is taken twice: as drawn (a screenshot of the game's own frame), and as a key pass drawn straight after with the rest of the world in black (so grass and ground in front of a figure hide it in the key as well) and each named mesh of the figure on a flat unlit key colour, split three ways in the shader: *struts* (vertices weighted over 0.5 to a `Wing2` bone), *feet* (faces whose bind-pose centre is under 0.16, the builder's foot rule), and the rest. The outline shells draw black and are left out. Each number is the median HSV value (the max of R, G and B) of that class's pixels in the frame as drawn. The dragon's feet and struts are on its body mesh; Ashmantle's on its crust mesh (its claws fall in the feet class too).

**Repeatability.** Two full runs; every median agrees within 0.8 points. The table gives run 1.

| Part | View a: Ashmantle / dragon / gap | View b | View c |
|---|---|---|---|
| Body (hide and belly) | 12.9 / 47.8 / **34.9** | 15.7 / 49.8 / **34.1** | 19.2 / 54.5 / **35.3** |
| Feet | 37.6 / 15.7 / **21.9** | 42.4 / 19.6 / **22.8** | 36.1 / 14.5 / **21.6** |
| Wing wrists and struts | 54.9 / 30.2 / **24.7** | 58.0 / 31.0 / **27.0** | 55.3 / 29.8 / **25.5** |
| Membrane (off the struts' bones / on them) | 20.8 / 56.1 / **35.3**; 22.4 / 61.2 / **38.8** | 21.2 / 56.1 / **34.9**; 22.4 / 61.2 / **38.8** | 20.8 / 56.9 / **36.1**; 22.4 / 61.6 / **39.2** |
| Crust against horn | 22.7 / 52.9 / **30.2** | 22.4 / 54.1 / **31.7** | 23.9 / 53.3 / **29.4** |
| Whole figure without glow | 22.0 / 56.5 / **34.5** | 22.0 / 56.5 / **34.5** | 22.4 / 57.3 / **34.9** |

Design 5.6 item 2 (value, at least 15 points from the dragon's) holds for every part and for the whole figure in all three views; the smallest gap is the feet in view c, 21.6. The feet samples are small (about 45 dragon pixels and 100 Ashmantle pixels a view, since grass covers most of the feet).

**The earlier readings.** The first repair stood the dragon 13 units along x, which puts it beyond a crest, partly hidden by the ground and grass (its script was not kept). Rerun here in that placement with a key pass that leaves the world out, the dragon's hidden pixels take the ground's values (its feet read 97). That is the likely source of the dragon's "backlit" membrane at 20.8 in view a and of the whole figure's 9.4. With each figure on the same spot and the world drawn black in the key, the dragon's membrane reads 56 to 62 in every view. The README's earlier 10-point figure (first build) was not like for like either.

`d3-ashmantle-values.jpg` is view b of this measurement: Ashmantle (left) and the dragon (right), each on Ashmantle's spot.

## Measured

| | Ashmantle | Dragon (D2) |
|---|---|---|
| Triangles | 9,560 (builder budget 9,600, manifest 12,000) | 9,960 |
| Meshes / materials | 4 / 4 | 4 / 4 |
| Width, height, length | 10.413, 3.601, 7.395 (length +4.1% of the old dragon's 7.101; the builder stops at 5%) | 10.413, 3.601, 7.094 |
| Figure raw bytes | 608,460 (ceiling 613,705) | 605,088 |
| Figure Brotli bytes, as exported | **264,320** (ceiling 267,112; design 9.1: 275 kB) | 269,694 |
| Figure Brotli bytes, packed by `packGlb` (Q1) | **157,369** (design 9.1 with N-3: 190 kB) | 154,626 |
| `monsters.glb` raw / Brotli | 4,959,136 / 1,278,638 (ceilings 5,007,888 / 1,286,669) | |

This repair changes only `ashmantle_body` and `ashmantle_crust` (the feet move from one to the other; the struts and wrists change material). Against the first repair's build, 772 of the 784 accessor and channel hashes match; the 12 that differ are the attributes and indices of those two meshes. The dragon, every other figure and all 110 animation channels (five dragon clips, 22 channels each) are byte-identical. Triangles are unchanged. COMPARE: Contract and Budget pass against the pending manifest, which the repair does not change.

**Pending manifest.** It holds:
- the `Monster_ashmantle` node, 22 `ashmantle_` bones, and 14 limbs copied from the dragon's;
- the skinned root, `vertexColor` `all`, four mesh classes and three materials;
- the figure's ceilings: 12,000 triangles, 4 meshes, 5 materials, raw 613,705 and Brotli 267,112 (the first build plus 1% and 2%);
- the file's ceilings: triangles 89,894, meshes 187, materials 43, raw 5,007,888, Brotli 1,286,669.

`clips` and `attackClips` are unchanged.

## The dragon's clips on Ashmantle's body (fixed in the D3 repair)

`attachMonsterGltfAnimator` in `src/engine/blenderMonsters.ts` stripped the library's prefix with `nodeKey` (`def.body ?? modelKey`). For Ashmantle that removed `ashmantle_` from tracks named `elvarg_dragon_...` and cached the result under `elvarg_dragon`, so no track matched a bone. It now strips with `modelKey`: design 6.1's clone row says a library is stripped "with the prefix of the figure that authored it". The `nodeKey` parameter, which nothing else read, is gone. `blenderMonsters.ts` and the Ashmantle cases in `tests/monster-motion.test.ts` are outside D3's file list; they await the main session's ratification (the D3 repair does not amend the plan itself). `ONE(tests/monster-motion.test.ts)` in a throw-away copy with the built `monsters.glb` and the pending manifest gives 66 passed and 22 skipped on this repair's build, both Ashmantle cases among the passed. Before the fix it gave 2 failed: the new Ashmantle case and D2b's dragon built-file case, both on `a fore leg swings in Walk`.

## Sheets

- `d3-ashmantle-turnaround.jpg`, `-silhouette.jpg`, `-worst-pose.jpg`, `-play-distance.jpg` (halved): `SHEETS(--only ashmantle --worst)` of this repair's build (the silhouette is byte-identical to the first build's; the dragon's sheets are D2b's). The offline render has no tint, so the paint looks lilac there; the game multiplies it grey.
- `d3-dragon-ashmantle-silhouette-85px.jpg`: the roster silhouette of the two at the hero's 85 px scale, Ashmantle at `modelScale` 1.2 (`review_scales.json`). It is front-on, so it shows the crown and the heavier trunk; the plates' blocky ridge and the club are in the side view of `d3-ashmantle-silhouette.jpg`.
- `d3-ashmantle-ingame.jpg` (numbers in `d3-ashmantle-ingame-rows.json`): CAPTURE at Ashmantle's arena of this repair's build, NVIDIA GPU (`scripts/capture-gpu.mjs`), `vite preview` of a build of a throw-away copy of this branch with the built `monsters.glb`, the pending manifest, `body: 'ashmantle'` on the row and the staged clips on the live dragon row (what D5 ships), the strip fix (now on the branch), and debug hooks (`__DEBUG.G`, `getTerrainHeight`). Top: three-quarter, side and play distance (the green dragon on the far hill); these are named `idle-*` in the rows but Ashmantle was already in its `attack` state, between strikes. Bottom: `WingBuffet` held under the `ember_cone` telegraph, a plain `Bite`, and `Walk` (it runs while the rows' state is `attack`, as Ashmantle closes in between strikes). The four named meshes have `FACET_CUT` and vertex colours, colour 0x8a8580 (the tint) on all but the embers; the four unnamed entries in the rows are their outline shells. `scale` 1.2.

- `d3-ashmantle-values.jpg`: view b of the like-for-like value measurement (above).

`s4/` was 2,266,458 bytes before D3, over the 2 MB a slice may hold; D3 adds 437,207 (2,703,665 in all). Cutting it is open for the main session.
