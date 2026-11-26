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

The engine multiplies Stage 4's `tint` (0x8a8580) into every material but the glow, after the tile. Each paint is therefore the colour wanted in the game over the tile's mean and over the tint (`_ashmantle_paint`). The highest value the hide can reach under the tint is about 40%, so it cannot be 15 points lighter than the dragon's 38%; every part goes darker instead, and the embers carry the light.

| Part | Dragon (`DRAGON_COLOURS`) | Ashmantle (`ASHMANTLE_COLOURS`) | Gap |
|---|---|---|---|
| Hide | 0x3F6139, 38% | 0x34302C, 20% | 18 |
| Feet and wing struts | 0x2E4A2E, 29% | 0x221F1C, 13% | 16 |
| Membrane | 0x80402E, 50% | 0x3A2A24, 23% | 27 |
| Belly | 0x9E8748, 62% | 0x5A534B, 35% | 27 |
| Horn / crust | 0xB8AD90, 72% | 0x7A756E, 48% | 24 |
| Glow | `mat_glow_orange` (maw) | `mat_glow_orange` (maw, eyes, seams) | |

Measured in the game (`play-distance.png` of the capture, one frame, noon, both figures lit alike): the HSV value of Ashmantle's grey body pixels has median 20% (quartiles 14% and 22%); the dragon's green hide pixels on the far hill have median 30% (27% and 40%). Plane tones, occlusion and shading pull both under their paint targets, so the measured hide gap is about 10 points, not 18. A lighter hide narrows it (the tint caps it at about 40%); a darker one loses the planes, which already read faint. The crust reads grey and the seams orange. Which way to move is a call for OM-S4.

## Measured

| | Ashmantle | Dragon (D2) |
|---|---|---|
| Triangles | 9,560 (builder budget 9,600, manifest 12,000) | 9,960 |
| Meshes / materials | 4 / 4 | 4 / 4 |
| Width, height, length | 10.413, 3.601, 7.395 (length +4.1% of the old dragon's 7.101; the builder stops at 5%) | 10.413, 3.601, 7.094 |
| Figure raw bytes | 607,628 | 605,088 |
| Figure Brotli bytes, as exported | **261,874** (design 9.1: 275 kB) | 269,694 |
| Figure Brotli bytes, packed by `packGlb` (Q1) | **153,226** (design 9.1 with N-3: 190 kB) | 154,626 |
| `monsters.glb` raw / Brotli | 4,958,304 / 1,273,929 | |

Pending manifest: `Monster_ashmantle` node, 22 `ashmantle_` bones and 14 limbs copied from the dragon's, the skinned root, `vertexColor` `all`, four mesh classes, three materials, the figure's ceilings (12,000 triangles, 4 meshes, 5 materials, raw 613,705 and Brotli 267,112, the build plus 1% and 2%), and the file's (triangles 89,894, meshes 187, materials 43, raw 5,007,888, Brotli 1,286,669). `clips` and `attackClips` are unchanged. COMPARE: Contract and Budget pass. Every accessor of the ten other figures and all five dragon animations (22 channels each, all on `elvarg_dragon_` nodes) are byte-identical to the build before D3.

## The engine does not play the dragon's clips on Ashmantle's body (open, blocks D5)

`attachMonsterGltfAnimator` in `src/engine/blenderMonsters.ts` strips the library's prefix with `nodeKey` (`def.body ?? modelKey`), so for Ashmantle it strips `ashmantle_` from tracks named `elvarg_dragon_...`, marks the clips stripped, and caches them under `elvarg_dragon`. Design 6.1 (the clone row) says a library is stripped "with the prefix of the figure that authored it". Measured against the built file, in a throw-away copy of this branch:

- the new case of `tests/monster-motion.test.ts` (Ashmantle with `body: 'ashmantle'` and the staged clips, before any dragon) fails: `a fore leg swings in Walk: expected 0 to be greater than 0.01`; and because the cache is poisoned, D2b's built-file dragon case fails the same way after it (2 failed, 64 passed).
- with `stripClipPrefix(monstersGltf.animations, modelKey)` in that one line, both pass (66 passed).

In a game where Ashmantle spawns first, neither dragon moves. The fix is one line in a file outside D3's list; it has to land before D5 sets `body: 'ashmantle'`.

## Sheets

- `d3-ashmantle-turnaround.jpg`, `-silhouette.jpg`, `-worst-pose.jpg`, `-play-distance.jpg` (halved): `SHEETS(--only elvarg_dragon,ashmantle --worst)` of the build. The offline render has no tint, so the paint looks lilac there; the game multiplies it grey.
- `d3-dragon-ashmantle-silhouette-85px.jpg`: the roster silhouette of the two at the hero's 85 px scale, Ashmantle at `modelScale` 1.2 (`review_scales.json`). It is front-on, so it shows the crown and the heavier trunk; the plates' blocky ridge and the club are in the side view of `d3-ashmantle-silhouette.jpg`.
- `d3-ashmantle-ingame.jpg` (numbers in `d3-ashmantle-ingame-rows.json`): CAPTURE at Ashmantle's arena, NVIDIA GPU (`scripts/capture-gpu.mjs`), `vite preview` of a build of a throw-away copy of this branch with the built `monsters.glb`, the pending manifest, `body: 'ashmantle'` on the row and the staged clips on the live dragon row (what D5 ships), the one-line strip fix above, and debug hooks (`__DEBUG.G`, `getTerrainHeight`). Top: three-quarter, side and play distance (the green dragon on the far hill); these are named `idle-*` in the rows but Ashmantle was already in its `attack` state, between strikes. Bottom: `WingBuffet` held under the `ember_cone` telegraph, a plain `Bite`, `Walk` on the way back to the arena (`return`). The four named meshes have `FACET_CUT` and vertex colours, colour 0x8a8580 (the tint) on all but the embers; the four unnamed entries in the rows are their outline shells. `scale` 1.2.

`s4/` was 2,266,458 bytes before D3, over the 2 MB a slice may hold; D3 adds 327,466 (2,593,924 in all). Cutting it is open for the main session.
