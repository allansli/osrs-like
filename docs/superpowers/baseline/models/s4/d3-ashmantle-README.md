# D3: Ashmantle, its own body on the dragon skeleton

Built with `BLEND(monsters)` on Blender 5.0.1 (`build_ashmantle` in `scripts/blender/build_monsters.py`). `Monster_ashmantle` stands at the file's origin, skinned on the dragon table with bones `ashmantle_<Bone>` at the dragon's own joints (`dragon_joints()`, unchanged), because the dragon's clips carry an absolute `Hips` track and the dragon-skeleton path does not rescale it. It has no clips of its own. Everything that tells it from the dragon is mesh and paint.

## What it is (design 5.6)

- **Heavier chest**: the dragon's stick graph with the chest and withers radii times 1.28 and 1.26, the waist 1.06, the neck base 1.12, and a deep brisket node (0.56 by 0.60) hanging between the fore legs.
- **Slag crown** fused to the skull in place of the swept horns: seven blunt faceted crags rooted inside the skull, tallest at the back.
- **Back plates with glowing seams**: ten flat slabs of pale crust in pairs, leaning apart, over a core on `mat_glow_orange` that stands 0.08 taller, so the seam glows along each crest and between the halves.
- **Clubbed tail**: a faceted knot of slag (0.40 by 0.34 by 0.44) with six blunt knobs on `TailPivot3`.
- Wings, membranes, fangs, tusks and claws on the dragon's pattern. The eyes are ember slits on the glow mesh, the maw glows as the dragon's does.
- Four skinned meshes, one per engine family: `ashmantle_body` (skin, the dragon-scale tile), `ashmantle_membrane` (leather), `ashmantle_crust` (plain), `ashmantle_embers` (glow). Three white materials of its own (`mat_skin_ashmantle_paint`, `mat_wing_ashmantle_paint`, `mat_horn_ashmantle_paint`); no mesh name holds `eye`.

## Values against the dragon's

The engine multiplies Stage 4's `tint` (0x8a8580) into every material but the glow, after the tile. Each paint is therefore the colour wanted in the game over the tile's mean and over the tint (`_ashmantle_paint`). The highest value the hide can reach under the tint is about 40%, so it cannot be 15 points lighter than the dragon's 38%; every part goes darker instead, and the embers carry the light. No part is painted under design 5.4's 18% floor.

| Part | Dragon (`DRAGON_COLOURS`) | Ashmantle (`ASHMANTLE_COLOURS`) | Gap | Plane tone (shade, lit) |
|---|---|---|---|---|
| Hide | 0x3F6139, 38% | 0x302C29, 19% | 19 | wide, (-0.40, +1.00) |
| Feet and wing struts | 0x2E4A2E, 29% | 0x2E2A26, 18% (the floor) | 11 | wide |
| Membrane | 0x80402E, 50% | 0x3A2A24, 23% | 27 | wide |
| Belly | 0x9E8748, 62% | 0x5A534B, 35% | 27 | narrow, (-0.25, +0.30) |
| Horn / crust | 0xB8AD90, 72% | 0x7A756E, 48% | 24 | narrow |
| Glow | `mat_glow_orange` (maw) | `mat_glow_orange` (maw, eyes, seams) | | |

The plane tone is the vertex-colour factor each carved plane takes from its normal against the key light (`_goblin_plane_tones`; the goblin and the dragon use (-0.25, +0.15)). On a hide this dark the narrow tone left the lit planes a few points over the shade planes, and the figure read as one black mass in the game. Ashmantle's dark parts therefore take the wide tone: a plane facing the light is painted up to twice as light, so the carving shows. Belly and crust keep a narrow one, as their paint is near the top of what the tile and the tint leave (`_ashmantle_paint` refuses a paint the lit tone would push over 1). The feet and wing struts went from 13% up to the 18% floor, so their gap to the dragon's dark tone is 11 points, not 15. The hide went from 20% to 19% so the measured gap below stays at 15 or more with the brighter lit planes.

### Measured in the game, like for like

Throw-away copy of this branch with the built `monsters.glb`, the pending manifest, `body: 'ashmantle'`, the staged dragon clips and a capture patch (`__DEBUG` exposes `THREE`, `G`, `getTerrainHeight`; a monster with `__tick` set is left out of `updateMonsters`). NVIDIA GPU, `balanced`, noon (`phase(0.5)`), clear. The dragon is moved beside Ashmantle (13 units along x, same heading), both frozen in their bind pose, the hero and the other monsters hidden. Three cameras at distance 26 (a: yaw 0.6, pitch 0.4; b: yaw 0.3, pitch 0.6; c: yaw 0.9, pitch 0.6). Each frame is taken twice: as drawn, and with every named mesh of the two figures swapped for a flat, unlit key colour, which gives each part's pixels exactly. The number is the median HSV value (max of R, G, B) of a part's pixels in the frame as drawn.

| Part, view | Ashmantle before | Ashmantle now | Dragon now | Gap now |
|---|---|---|---|---|
| Hide (body mesh), a | 10.6 (quartiles 7.5, 19.6) | 12.2 (7.5, 23.9) | 29.4 | **17.2** |
| Hide, b | 13.7 (8.6, 21.6) | 18.8 (9.0, 25.5) | 34.1 | **15.3** |
| Hide, c | 14.9 (8.2, 21.6) | 20.8 (9.0, 27.1) | 36.5 | **15.7** |
| Crust against horn, a / b / c | 22.0 / 22.0 / 26.3 | 22.4 / 22.4 / 26.3 | 57.3 / 56.1 / 58.0 | 34.9 / 33.7 / 31.7 |
| Membrane, a / b / c | 25.5 / 24.7 / 25.1 | 28.6 / 27.1 / 27.8 | 22.4 / 66.7 / 54.5 | -6.2 / 39.6 / 26.7 |
| Whole figure without glow, a / b / c | 21.2 / 22.0 / 21.6 | 22.0 / 23.5 / 23.5 | 31.4 / 49.8 / 39.6 | 9.4 / 26.3 / 16.1 |

The main colour, the hide, is 15 or more points under the dragon's in all three views (design 5.6 item 2). The hide's upper quartile, its lit planes, went from 20-22% to 24-27%, and its spread between quartiles from 12-13 points to 16-18 points. `d3-ashmantle-values.jpg` shows view b before (left) and now (right). Two rows are under 15. In view a the dragon's membrane is lit from behind and reads at 22%, under Ashmantle's. The whole-figure gap in view a is 9.4 for the same reason, since in that view the dragon's visible area is mostly membrane. These numbers come from the angle and are not a paint choice: a membrane darker than 7% would be a void. The README's earlier 10-point figure compared Ashmantle near the camera with the dragon on a far hill, measured over different parts, so it did not compare like with like.

## Measured

| | Ashmantle | Dragon (D2) |
|---|---|---|
| Triangles | 9,560 (builder budget 9,600, manifest 12,000) | 9,960 |
| Meshes / materials | 4 / 4 | 4 / 4 |
| Width, height, length | 10.413, 3.601, 7.395 (length +4.1% of the old dragon's 7.101; the builder stops at 5%) | 10.413, 3.601, 7.094 |
| Figure raw bytes | 609,396 (ceiling 613,705) | 605,088 |
| Figure Brotli bytes, as exported | **262,606** (ceiling 267,112; design 9.1: 275 kB) | 269,694 |
| Figure Brotli bytes, packed by `packGlb` (Q1) | **154,968** (design 9.1 with N-3: 190 kB) | 154,626 |
| `monsters.glb` raw / Brotli | 4,960,072 / 1,275,761 (ceilings 5,007,888 / 1,286,669) | |

The repaint changes only the `COLOR_0` of `ashmantle_body`, `ashmantle_crust` and `ashmantle_membrane`. The plane tones split a few more vertices, which adds 1,768 raw bytes. Every other accessor of the file, the dragon's included, and all 110 animation channels (five dragon clips, 22 channels each) are byte-identical to the first D3 build (771 of the 784 accessor and channel hashes are the same; the 13 that differ are attributes of those three meshes). COMPARE: Contract and Budget pass against the pending manifest, which is unchanged by the repair.

Pending manifest: `Monster_ashmantle` node, 22 `ashmantle_` bones and 14 limbs copied from the dragon's, the skinned root, `vertexColor` `all`, four mesh classes, three materials, the figure's ceilings (12,000 triangles, 4 meshes, 5 materials, raw 613,705 and Brotli 267,112, the first build plus 1% and 2%), and the file's (triangles 89,894, meshes 187, materials 43, raw 5,007,888, Brotli 1,286,669). `clips` and `attackClips` are unchanged.

## The dragon's clips on Ashmantle's body (fixed in the D3 repair)

`attachMonsterGltfAnimator` in `src/engine/blenderMonsters.ts` stripped the library's prefix with `nodeKey` (`def.body ?? modelKey`). For Ashmantle that removed `ashmantle_` from tracks named `elvarg_dragon_...` and cached the result under `elvarg_dragon`, so no track matched a bone. It now strips with `modelKey`: design 6.1's clone row says a library is stripped "with the prefix of the figure that authored it". The `nodeKey` parameter, which nothing else read, is gone (plan, "D3 amendments"). `ONE(tests/monster-motion.test.ts)` in a throw-away copy with the built `monsters.glb` and the pending manifest gives 66 passed and 22 skipped. Before the fix it gave 2 failed: the new Ashmantle case and D2b's dragon built-file case, both on `a fore leg swings in Walk`.

## Sheets

- `d3-ashmantle-turnaround.jpg`, `-silhouette.jpg`, `-worst-pose.jpg`, `-play-distance.jpg` (halved): `SHEETS(--only ashmantle --worst)` of the repainted build (the silhouette is byte-identical to the first build's; the dragon's sheets are D2b's). The offline render has no tint, so the paint looks lilac there; the game multiplies it grey.
- `d3-dragon-ashmantle-silhouette-85px.jpg`: the roster silhouette of the two at the hero's 85 px scale, Ashmantle at `modelScale` 1.2 (`review_scales.json`). It is front-on, so it shows the crown and the heavier trunk; the plates' blocky ridge and the club are in the side view of `d3-ashmantle-silhouette.jpg`.
- `d3-ashmantle-ingame.jpg` (numbers in `d3-ashmantle-ingame-rows.json`): CAPTURE at Ashmantle's arena of the repainted build, NVIDIA GPU (`scripts/capture-gpu.mjs`), `vite preview` of a build of a throw-away copy of this branch with the built `monsters.glb`, the pending manifest, `body: 'ashmantle'` on the row and the staged clips on the live dragon row (what D5 ships), the strip fix (now on the branch), and debug hooks (`__DEBUG.G`, `getTerrainHeight`). Top: three-quarter, side and play distance (the green dragon on the far hill); these are named `idle-*` in the rows but Ashmantle was already in its `attack` state, between strikes. Bottom: `WingBuffet` held under the `ember_cone` telegraph, a plain `Bite`, and `Walk` (it runs while the rows' state is `attack`, as Ashmantle closes in between strikes). The four named meshes have `FACET_CUT` and vertex colours, colour 0x8a8580 (the tint) on all but the embers; the four unnamed entries in the rows are their outline shells. `scale` 1.2.

- `d3-ashmantle-values.jpg`: view b of the like-for-like value measurement, the first build (left) and the repainted one (right), Ashmantle in front and the dragon behind.

`s4/` was 2,266,458 bytes before D3, over the 2 MB a slice may hold; D3 adds 412,188 (2,678,646 in all). Cutting it is open for the main session.
