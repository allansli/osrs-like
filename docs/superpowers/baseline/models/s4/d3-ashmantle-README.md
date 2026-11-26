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

The engine multiplies Stage 4's `tint` (0x8a8580) into every material except the glow, after the tile. Each paint is therefore the colour wanted in the game divided by the tile's mean and by the tint (`_ashmantle_paint`). Under the tint the hide can reach about 40% at most. That is too close to the dragon's 38% to be 15 points lighter, so every part goes darker and the embers carry the light. No part is painted under design 5.4's 18% floor.

| Part | Dragon (`DRAGON_COLOURS`) | Ashmantle (`ASHMANTLE_COLOURS`) | Gap | Plane tone (shade, lit) |
|---|---|---|---|---|
| Hide | 0x3F6139, 38% | 0x2E2B28, 18% (the floor) | 20 | wide, (-0.40, +0.85) |
| Feet and wing struts | 0x2E4A2E, 29% | 0x2E2A26, 18% (the floor) | **11** | wide |
| Membrane | 0x80402E, 50% | 0x3A2A24, 23% | 27 | wide |
| Belly | 0x9E8748, 62% | 0x5A534B, 35% | 27 | narrow, (-0.25, +0.30) |
| Horn / crust | 0xB8AD90, 72% | 0x7A756E, 48% | 24 | narrow |
| Glow | `mat_glow_orange` (maw) | `mat_glow_orange` (maw, eyes, seams) | | |

The plane tone is a vertex-colour factor. Each carved plane takes it from its normal measured against the key light (`_goblin_plane_tones`). The goblin and the dragon use (-0.25, +0.15). On a hide this dark, that narrow tone put the lit planes only a few points above the shade planes, and the figure read as one black mass in the game. So Ashmantle's dark parts take a wide tone: a plane facing the light is painted up to 1.85 times as light. Belly and crust keep a narrow tone, because their paint is already near the top of what the tile and tint leave. `_ashmantle_paint` refuses any paint that the lit tone would push over 1.

The first build painted the hide at 20% and the feet and wing struts at 13%. The feet and struts go up to the floor. That leaves them 11 points from the dragon's dark tone, which is under 15. The hide goes down to the floor, so the brighter lit planes do not close the measured gap below. Hide and feet now share one value; the feet are told apart by the dragon-scale tile and their own planes. Design 5.4's floor and design 5.6's 15 points, read part by part, cannot both hold for the feet. That choice is open for the owner.

### Measured in the game, like for like

**Setup.** This was a throw-away copy of this branch. It had:
- the built `monsters.glb` and the pending manifest;
- `body: 'ashmantle'` and the staged dragon clips;
- a capture patch: `__DEBUG` exposes `THREE`, `G` and `getTerrainHeight`, and `updateMonsters` skips a monster with `__tick` set.

The run used the NVIDIA GPU, `balanced`, noon (`phase(0.5)`) and clear weather. The dragon is moved beside Ashmantle, 13 units along x with the same heading. Both are frozen in their bind pose: the clips are stopped and `skeleton.pose()` is called. The hero and the other monsters are hidden. There are three cameras at distance 26:
- a: yaw 0.6, pitch 0.4;
- b: yaw 0.3, pitch 0.6;
- c: yaw 0.9, pitch 0.6.

**Method.** Each frame is taken twice: once as drawn, and once with every named mesh of the two figures swapped for a flat, unlit key colour. The second frame picks out each part's pixels exactly. Each number is the median HSV value (the max of R, G and B) of a part's pixels in the frame as drawn.

**Repeatability.** The repainted build was run five times: three runs at hide 19% with the lit tone +1.00, then two runs of the final paint. Both runs of the final paint agree to 0.4. The first build was measured once in the same setup.

| Part, view | First build | Now (worst of two runs) | Dragon | Gap now |
|---|---|---|---|---|
| Hide (body mesh), a | 10.2 (quartiles 7.1, 18.8) | 11.0 (7.1, 21.6) | 29.4 | **18.4** |
| Hide, b | 13.7 (8.6, 21.2) | 17.6 (8.6, 23.1) | 33.7 | **16.1** |
| Hide, c | 14.5 (8.2, 21.2) | 19.2 (8.6, 24.3) | 36.5 | **17.3** |
| Crust against horn, a / b / c | 22.0 / 22.0 / 25.9 | 22.0 / 22.4 / 25.9 | 56.9 / 55.7 / 58.0 | 34.9 / 33.3 / 32.1 |
| Membrane, a / b / c | 25.1 / 24.3 / 24.3 | 27.5 / 26.3 / 27.1 | 20.8 / 65.1 / 49.0 | **-6.7** / 38.8 / 21.9 |
| Whole figure without glow, a / b / c | 19.4 / 21.6 / 20.8 | 21.6 / 22.0 / 22.0 | 31.0 / 48.6 / 38.8 | **9.4** / 26.6 / 16.8 |

**What is met.** The hide is the main colour. In every view it is 16 or more points under the dragon's (design 5.6 item 2, read on the main colour).

**Definition.** The hide's lit planes (upper quartile) went from 19-21% to 22-24%. Its spread between quartiles went from 12-13 points to 14-16 points. That is a modest gain. The tint and the gap requirement both cap how light the lit planes can go. `d3-ashmantle-values.jpg` shows view b, the first build on the left and now on the right.

**Still under 15 (open):**
- **Feet and wing struts**: 11 points on the paint targets, set by the floor (above).
- **Membrane, view a**: the dragon's membrane is lit from behind and reads at 21%, under Ashmantle's. No membrane value can fix this short of a void.
- **Whole figure, view a**: 9.4, for the same reason, since in that view the dragon's visible area is mostly membrane.

Whether design 5.6's 15 points are read on the main colour, part by part, or on the whole figure is not settled by the design. It is proposed in the plan's "D3 amendments" for the main session or the owner to decide.

**Earlier figure.** The README's earlier 10-point figure was not like for like. It compared Ashmantle near the camera with the dragon on a far hill, over different parts.

## Measured

| | Ashmantle | Dragon (D2) |
|---|---|---|
| Triangles | 9,560 (builder budget 9,600, manifest 12,000) | 9,960 |
| Meshes / materials | 4 / 4 | 4 / 4 |
| Width, height, length | 10.413, 3.601, 7.395 (length +4.1% of the old dragon's 7.101; the builder stops at 5%) | 10.413, 3.601, 7.094 |
| Figure raw bytes | 608,980 (ceiling 613,705) | 605,088 |
| Figure Brotli bytes, as exported | **262,170** (ceiling 267,112; design 9.1: 275 kB) | 269,694 |
| Figure Brotli bytes, packed by `packGlb` (Q1) | **154,589** (design 9.1 with N-3: 190 kB) | 154,626 |
| `monsters.glb` raw / Brotli | 4,959,656 / 1,275,753 (ceilings 5,007,888 / 1,286,669) | |

The repaint changes only the `COLOR_0` of `ashmantle_body`, `ashmantle_crust` and `ashmantle_membrane`. The plane tones split a few more vertices, which adds 1,352 raw bytes. Everything else in the file, including the dragon, is byte-identical to the first D3 build, and so are all 110 animation channels (five dragon clips, 22 channels each). In numbers: 771 of the 784 accessor and channel hashes match, and the 13 that differ are attributes of those three meshes. COMPARE: Contract and Budget pass against the pending manifest, which the repair does not change.

**Pending manifest.** It holds:
- the `Monster_ashmantle` node, 22 `ashmantle_` bones, and 14 limbs copied from the dragon's;
- the skinned root, `vertexColor` `all`, four mesh classes and three materials;
- the figure's ceilings: 12,000 triangles, 4 meshes, 5 materials, raw 613,705 and Brotli 267,112 (the first build plus 1% and 2%);
- the file's ceilings: triangles 89,894, meshes 187, materials 43, raw 5,007,888, Brotli 1,286,669.

`clips` and `attackClips` are unchanged.

## The dragon's clips on Ashmantle's body (fixed in the D3 repair)

`attachMonsterGltfAnimator` in `src/engine/blenderMonsters.ts` stripped the library's prefix with `nodeKey` (`def.body ?? modelKey`). For Ashmantle that removed `ashmantle_` from tracks named `elvarg_dragon_...` and cached the result under `elvarg_dragon`, so no track matched a bone. It now strips with `modelKey`: design 6.1's clone row says a library is stripped "with the prefix of the figure that authored it". The `nodeKey` parameter, which nothing else read, is gone (plan, "D3 amendments"). `ONE(tests/monster-motion.test.ts)` in a throw-away copy with the built `monsters.glb` and the pending manifest gives 66 passed and 22 skipped. Before the fix it gave 2 failed: the new Ashmantle case and D2b's dragon built-file case, both on `a fore leg swings in Walk`.

## Sheets

- `d3-ashmantle-turnaround.jpg`, `-silhouette.jpg`, `-worst-pose.jpg`, `-play-distance.jpg` (halved): `SHEETS(--only ashmantle --worst)` of the repainted build (the silhouette is byte-identical to the first build's; the dragon's sheets are D2b's). The offline render has no tint, so the paint looks lilac there; the game multiplies it grey.
- `d3-dragon-ashmantle-silhouette-85px.jpg`: the roster silhouette of the two at the hero's 85 px scale, Ashmantle at `modelScale` 1.2 (`review_scales.json`). It is front-on, so it shows the crown and the heavier trunk; the plates' blocky ridge and the club are in the side view of `d3-ashmantle-silhouette.jpg`.
- `d3-ashmantle-ingame.jpg` (numbers in `d3-ashmantle-ingame-rows.json`): CAPTURE at Ashmantle's arena of the repainted build, NVIDIA GPU (`scripts/capture-gpu.mjs`), `vite preview` of a build of a throw-away copy of this branch with the built `monsters.glb`, the pending manifest, `body: 'ashmantle'` on the row and the staged clips on the live dragon row (what D5 ships), the strip fix (now on the branch), and debug hooks (`__DEBUG.G`, `getTerrainHeight`). Top: three-quarter, side and play distance (the green dragon on the far hill); these are named `idle-*` in the rows but Ashmantle was already in its `attack` state, between strikes. Bottom: `WingBuffet` held under the `ember_cone` telegraph, a plain `Bite`, and `Walk` (it runs while the rows' state is `attack`, as Ashmantle closes in between strikes). The four named meshes have `FACET_CUT` and vertex colours, colour 0x8a8580 (the tint) on all but the embers; the four unnamed entries in the rows are their outline shells. `scale` 1.2.

- `d3-ashmantle-values.jpg`: view b of the like-for-like value measurement, the first build (left) and the repainted one (right), Ashmantle in front and the dragon behind.

`s4/` was 2,266,458 bytes before D3, over the 2 MB a slice may hold; D3 adds 395,798 (2,662,256 in all). Cutting it is open for the main session.
