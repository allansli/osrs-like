# GR7 and GR8 ground: perf HUD per picture

GR8 (fixes after CP-GR) replaced the pictures of P1, P3, P5, P7 and P8 and the two tables below with captures of the final GR8 bundle (`index-BVwV2LzT.js`, at d1002da, which adds the carpet cell scramble of the amendment to the first pass at 07fa27f, `index-M8HWa8Lt.js`), plus P7 noon and golden on high, on the same renderer: headless Chromium on the NVIDIA GPU (`scripts/capture-gpu.mjs`, ANGLE over D3D12, RTX 4070 Laptop). The P6, P9 and P10 pictures and rows are still the GR7 bundle's (`index-CuXy7y9D.js`); GR8 changes no file that draws more or fewer meshes, so their counts stand, but their look is GR7's: the apron at its old level in all 16 P10 shots and the P6 sky, the GR7 woods floor wherever P6 shows it, and the GR7 carpet layout (on diagonals) wherever a carpet is in frame. 1280x720, seeded `Math.random`, cleared storage, mouse parked on `#top-left-hud`, skills at 99 from a fresh load (capture.md, aggressive ground). Every shot: player alive (hp 99, read after the shot), position logged below. Frame times are not recorded: they come only from `look.bench` on the owner's machine (OV-2).

`look.weather` does not exist yet (lane WX), so P6 is dawn without rain, P7 has no haze and P9 no overcast. `look.phase` sets the time: night 0.00, dawn 0.25, noon 0.50, golden 0.70.

"HUD" is `#perf-calls` (colour pass plus shadow pass). "Colour" and "shadow" split the same frames by counting WebGL draw calls per frame over 1 s, by the framebuffer bound at the draw: none (the canvas) is the colour pass on the direct-path tiers (performance, balanced), a render target is the shadow pass. On high and ultra the colour pass also renders into the composer's target, so only the total is meaningful there.

## Calls and triangles at P1, P3, P5 and P8 on every tier (GR8)

| pose | time | tier | HUD calls | triangles | colour calls | shadow calls |
|---|---|---|---|---|---|---|
| P1 | noon | performance | 1212 | 283k | 1205 | 0 |
| P3 | golden | performance | 257 | 223k | 257 | 0 |
| P5 | noon | performance | 115 | 135k | 115 | 0 |
| P8 | noon | performance | 276 | 228k | 276 | 0 |
| P1 | noon | balanced | 2161 | 672k | 1214 | 951 |
| P3 | golden | balanced | 1428 | 592k | 264 | 1161 |
| P5 | noon | balanced | 284 | 354k | 118 | 166 |
| P8 | noon | balanced | 618 | 407k | 280 | 335 |
| P1 | noon | high | 2549 | 802k | - | - |
| P3 | golden | high | 1975 | 786k | - | - |
| P5 | noon | high | 365 | 458k | - | - |
| P8 | noon | high | 1176 | 690k | - | - |
| P1 | noon | ultra | 2999 | 979k | - | - |
| P3 | golden | ultra | 2117 | 905k | - | - |
| P5 | noon | ultra | 462 | 543k | - | - |
| P8 | noon | ultra | 1592 | 903k | - | - |

GR8 accept, P1 noon balanced within 5% of GR7: 2161 calls and 672k triangles (the balanced rows of both tables are one run here) against GR7's tier-table 2170 and 675k (-0.4%, -0.4%) and its look-set 2160 and 672k (+0.0%, 0%). The carpet scramble moves no instance and adds no draw.

## Look set (balanced), the pictures in this folder

| picture | bundle | HUD calls | triangles | colour calls | shadow calls | player x, z |
|---|---|---|---|---|---|---|
| P1-noon-balanced | GR8 | 2161 | 672k | 1214 | 951 | 0.0, 0.0 |
| P1-golden-balanced | GR8 | 2596 | 747k | 1190 | 1407 | 0.0, 0.0 |
| P1-night-balanced | GR8 | 2265 | 690k | 1195 | 1069 | 0.0, 0.0 |
| P3-golden-balanced | GR8 | 1428 | 592k | 264 | 1161 | -8.0, 50.0 |
| P6-dawn-balanced | GR7 | 1129 | 515k | 316 | 813 | -29.0, -30.0 |
| P7-noon-balanced | GR8 | 464 | 259k | 179 | 290 | 85.0, 90.0 |
| P7-noon-high | GR8 | 598 | 343k | - | - | 85.0, 90.0 |
| P7-golden-balanced | GR8 | 443 | 266k | 154 | 294 | 85.0, 90.0 |
| P7-golden-high | GR8 | 671 | 379k | - | - | 85.0, 90.0 |
| P8-noon-balanced | GR8 | 618 | 407k | 280 | 335 | -50.0, -13.0 |
| P8-night-balanced | GR8 | 620 | 407k | 283 | 342 | -50.0, -13.0 |
| P8-pitch0.12-noon-balanced | GR8 | 618 | 407k | 283 | 335 | -50.0, -13.0 |
| P8-pitch1.15-noon-balanced | GR8 | 388 | 260k | 60 | 337 | -50.0, -13.0 |
| P9-noon-balanced | GR7 | 1307 | 408k | 880 | 427 | 78.0, -20.0 |
| P10-y0.0-noon-balanced | GR7 | 2197 | 701k | 1257 | 936 | 13.0, 8.0 |
| P10c-y0.0-noon-balanced | GR7 | 440 | 242k | 199 | 247 | 116.0, 116.0 |
| P10-y0.785-noon-balanced | GR7 | 2356 | 695k | 1383 | 977 | 13.0, 8.0 |
| P10c-y0.785-noon-balanced | GR7 | 485 | 253k | 238 | 246 | 116.0, 116.0 |
| P10-y1.571-noon-balanced | GR7 | 2551 | 740k | 1522 | 1027 | 13.0, 8.0 |
| P10c-y1.571-noon-balanced | GR7 | 455 | 245k | 207 | 248 | 116.0, 116.0 |
| P10-y2.356-noon-balanced | GR7 | 2071 | 716k | 979 | 1092 | 13.0, 8.0 |
| P10c-y2.356-noon-balanced | GR7 | 491 | 256k | 246 | 245 | 116.0, 116.0 |
| P10-y3.142-noon-balanced | GR7 | 2025 | 755k | 913 | 1103 | 13.0, 8.0 |
| P10c-y3.142-noon-balanced | GR7 | 1960 | 629k | 1751 | 242 | 116.0, 116.0 |
| P10-y3.927-noon-balanced | GR7 | 2300 | 790k | 1236 | 1132 | 13.0, 8.0 |
| P10c-y3.927-noon-balanced | GR7 | 2727 | 865k | 2484 | 243 | 116.0, 116.0 |
| P10-y4.712-noon-balanced | GR7 | 2349 | 898k | 1256 | 1059 | 13.0, 8.0 |
| P10c-y4.712-noon-balanced | GR7 | 1633 | 568k | 1404 | 246 | 116.0, 116.0 |
| P10-y5.498-noon-balanced | GR7 | 2021 | 731k | 1004 | 1029 | 13.0, 8.0 |
| P10c-y5.498-noon-balanced | GR7 | 493 | 256k | 247 | 246 | 116.0, 116.0 |

P10 is Three Kettle Camp at pitch 0.12 and distance 26, eight yaws (`P10-y<yaw>`), and the same eight yaws with the hero moved to (116, 116), the walkable corner used for the "from the corner" set (`P10c-y<yaw>`). P8 is also shot at the two pitch limits (`P8-pitch0.12`, `P8-pitch1.15`) to judge the woods trees.

## GR7 Accept limits at P1 noon, balanced: missed (GR7 bundle; moved to the models pass, plan amendment 2026-11-24)

| limit | V2 reference | GR7 | pass |
|---|---|---|---|
| colour-pass calls <= 60% of V2 and <= 1000 | V2 has totals only; its performance row (no shadow pass) is 1479, so 60% is 887 | 1178 (this run's tier table), 1214 (look set) | no |
| calls with the shadow pass <= 60% of V2 | 3207, so 1924 | 2170 (2160 in the look set) | no |
| triangles <= 550k | | 675k (672k) | no |

Thinning the flora cannot meet these limits, so `scatterDensity` and `carpetTufts` are unchanged. Measured at P1 noon balanced on the bundle before the tune (`index-CAihQqkq.js`, which differs only in two `clusterDensity` values away from P1), HUD counts: everything shown 2129 calls and 666k triangles; every kit, woods-tree and carpet mesh hidden 2099 calls and 589k triangles; monsters hidden as well 593 calls and 369k triangles. At this pose the scene holds 2599 visible meshes, of which 1875 belong to 42 monster groups (about 45 meshes each, not merged) and 21 to the flora (15 kit pieces, 4 carpet variants, 2 woods trees). The calls and triangles over the limit belong to the monster models (Stage 2 to 4 code outside GR7's files), not to the vegetation. The main session decides what follows.

## What GR7 tuned, and what it left for CP-GR

- `FLORA_RULES`: `woods` clusterDensity 1.2 to 1.6 (a denser woods floor of ferns, logs, mushrooms and saplings), `varrock` 0.6 to 0.8 (more planters and weeds around the plaza). No other rule, piece list or tint family changed.
- Woods trees: kept at 150 (no `tune(ground): woods tree count` commit). At P8 pitch 0.12 the wood reads as a forest wall with open lanes around the hollow; at pitch 1.15 no crown hides the hero; at P6 the wood is already thick. A new table would also move the cells `tests/pathfind-budget.test.ts` draws, and the fixture's one authorized regeneration was TR2's.
- Outside GR7's files, for the owner at CP-GR: the woods ground and carpet read bright meadow green, not the dark moss of design 5.5 (ground shader and carpet tints); the woods-tree crowns are near black at noon (`floraKit.ts` tint); the desert carpet looks gridded at P7; the Tamarisk Pool pillar fills the P7 frame at this pose.

## Repair re-measurement on the GR7 head (P1 noon balanced)

This run used the GR7 bundle itself (`index-CuXy7y9D.js`, built at 4504e4b) on the same renderer (ANGLE over D3D12, RTX 4070 Laptop), with seeded `Math.random`, cleared storage, skills at 99 and the mouse on `#top-left-hud`. The colour and shadow columns count WebGL draws per frame over 1 s, split by the bound framebuffer, and they add up to the HUD total within frame-to-frame variation.

| state | HUD calls | triangles | colour calls | shadow calls |
|---|---|---|---|---|
| everything shown | 2162 | 672k | 1215 | 951 |
| every kit, woods-tree and carpet mesh hidden | 2157 | 598k | 1176 | 961 |
| monsters hidden as well | 593 | 369k | 256 | 337 |

With no flora at all, P1 on balanced is still over every limit: 1176 colour calls (limits 887 and 1000), 2157 total calls (limit 1924) and 598k triangles (limit 550k). With the flora hidden, the triangle count equals V2's own 593k, so the 550k limit sits below the scene before any flora was added. Thinning `scatterDensity` or `carpetTufts`, the only remedy GR7 allows, cannot meet these limits, so neither was changed.

V2's reference is `before/perf.md`, P1 noon: 1479 calls on performance and 3207 calls with 593k triangles on balanced. It was shot at the same pose. The monster spawn code has not changed since that capture: the only change to `spawns.ts`, 4b08a85, touches resource nodes. V2 recorded totals only, so its performance row, which has no shadow pass, stands in for the colour pass.

Which remedy to take is open for the main session: merge the monster models, which lie outside GR7's files, or have the owner amend the limit.
