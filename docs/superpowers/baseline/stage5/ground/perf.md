# GR7 ground: perf HUD per picture

Renderer: headless Chromium on the NVIDIA GPU (`scripts/capture-gpu.mjs`, ANGLE over D3D12, RTX 4070 Laptop), bundle `index-CuXy7y9D.js` (after the GR7 tune). 1280x720, seeded `Math.random`, cleared storage, mouse parked on `#top-left-hud`, skills at 99 from a fresh load (capture.md, aggressive ground). Every shot: player alive (hp 99, read after the shot), position logged below. Frame times are not recorded: they come only from `look.bench` on the owner's machine (OV-2).

`look.weather` does not exist yet (lane WX), so P6 is dawn without rain, P7 has no haze and P9 no overcast. `look.phase` sets the time: night 0.00, dawn 0.25, noon 0.50, golden 0.70.

"HUD" is `#perf-calls` (colour pass plus shadow pass). "Colour" and "shadow" split the same frames by counting WebGL draw calls per frame over 1 s, by the framebuffer bound at the draw: none (the canvas) is the colour pass on the direct-path tiers (performance, balanced), a render target is the shadow pass. On high and ultra the colour pass also renders into the composer's target, so only the total is meaningful there.

## Calls and triangles at P1, P3, P5 and P8 on every tier

| pose | time | tier | HUD calls | triangles | colour calls | shadow calls |
|---|---|---|---|---|---|---|
| P1 | noon | performance | 1212 | 283k | 1208 | 0 |
| P3 | golden | performance | 257 | 223k | 257 | 0 |
| P5 | noon | performance | 115 | 135k | 112 | 0 |
| P8 | noon | performance | 276 | 228k | 276 | 0 |
| P1 | noon | balanced | 2170 | 675k | 1178 | 976 |
| P3 | golden | balanced | 1429 | 617k | 264 | 1163 |
| P5 | noon | balanced | 284 | 354k | 120 | 168 |
| P8 | noon | balanced | 619 | 407k | 284 | 372 |
| P1 | noon | high | 2570 | 806k | - | - |
| P3 | golden | high | 1939 | 782k | - | - |
| P5 | noon | high | 365 | 458k | - | - |
| P8 | noon | high | 1123 | 683k | - | - |
| P1 | noon | ultra | 3029 | 983k | - | - |
| P3 | golden | ultra | 2117 | 905k | - | - |
| P5 | noon | ultra | 468 | 554k | - | - |
| P8 | noon | ultra | 1589 | 903k | - | - |

## Look set (balanced), the pictures in this folder

| picture | HUD calls | triangles | colour calls | shadow calls | player x, z |
|---|---|---|---|---|---|
| P1-noon-balanced | 2160 | 672k | 1214 | 954 | 0.0, 0.0 |
| P1-golden-balanced | 2594 | 747k | 1190 | 1403 | 0.0, 0.0 |
| P1-night-balanced | 2261 | 689k | 1194 | 1071 | 0.0, 0.0 |
| P3-golden-balanced | 1445 | 596k | 264 | 1174 | -8.0, 50.0 |
| P6-dawn-balanced | 1129 | 515k | 316 | 813 | -29.0, -30.0 |
| P7-noon-balanced | 437 | 255k | 147 | 290 | 85.0, 90.0 |
| P7-golden-balanced | 477 | 271k | 166 | 299 | 85.0, 90.0 |
| P8-noon-balanced | 680 | 415k | 321 | 360 | -50.0, -13.0 |
| P8-night-balanced | 624 | 408k | 283 | 337 | -50.0, -13.0 |
| P8-pitch0.12-noon-balanced | 660 | 412k | 304 | 350 | -50.0, -13.0 |
| P8-pitch1.15-noon-balanced | 377 | 259k | 60 | 309 | -50.0, -13.0 |
| P9-noon-balanced | 1307 | 408k | 880 | 427 | 78.0, -20.0 |
| P10-y0.0-noon-balanced | 2197 | 701k | 1257 | 936 | 13.0, 8.0 |
| P10c-y0.0-noon-balanced | 440 | 242k | 199 | 247 | 116.0, 116.0 |
| P10-y0.785-noon-balanced | 2356 | 695k | 1383 | 977 | 13.0, 8.0 |
| P10c-y0.785-noon-balanced | 485 | 253k | 238 | 246 | 116.0, 116.0 |
| P10-y1.571-noon-balanced | 2551 | 740k | 1522 | 1027 | 13.0, 8.0 |
| P10c-y1.571-noon-balanced | 455 | 245k | 207 | 248 | 116.0, 116.0 |
| P10-y2.356-noon-balanced | 2071 | 716k | 979 | 1092 | 13.0, 8.0 |
| P10c-y2.356-noon-balanced | 491 | 256k | 246 | 245 | 116.0, 116.0 |
| P10-y3.142-noon-balanced | 2025 | 755k | 913 | 1103 | 13.0, 8.0 |
| P10c-y3.142-noon-balanced | 1960 | 629k | 1751 | 242 | 116.0, 116.0 |
| P10-y3.927-noon-balanced | 2300 | 790k | 1236 | 1132 | 13.0, 8.0 |
| P10c-y3.927-noon-balanced | 2727 | 865k | 2484 | 243 | 116.0, 116.0 |
| P10-y4.712-noon-balanced | 2349 | 898k | 1256 | 1059 | 13.0, 8.0 |
| P10c-y4.712-noon-balanced | 1633 | 568k | 1404 | 246 | 116.0, 116.0 |
| P10-y5.498-noon-balanced | 2021 | 731k | 1004 | 1029 | 13.0, 8.0 |
| P10c-y5.498-noon-balanced | 493 | 256k | 247 | 246 | 116.0, 116.0 |

P10 is Three Kettle Camp at pitch 0.12 and distance 26, eight yaws (`P10-y<yaw>`), and the same eight yaws with the hero moved to (116, 116), the walkable corner used for the "from the corner" set (`P10c-y<yaw>`). P8 is also shot at the two pitch limits (`P8-pitch0.12`, `P8-pitch1.15`) to judge the woods trees.

## GR7 Accept limits at P1 noon, balanced: missed

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

Re-run on the GR7 bundle itself (`index-CuXy7y9D.js`, BUILD at 4504e4b), same renderer (ANGLE over D3D12, RTX 4070 Laptop), seeded `Math.random`, cleared storage, skills 99, mouse on `#top-left-hud`. HUD counts, two runs:

| state | HUD calls | triangles | colour calls (est.) |
|---|---|---|---|
| everything shown | 2161 / 2162 | 672k | about 1213 |
| every kit, woods-tree and carpet mesh hidden | 2117 / 2149 | 592k / 596k | about 1178 |
| monsters hidden as well | 593 | 369k | about 256 |

The HUD totals reproduce the table above. In this run the raw per-frame WebGL draw count came out about 1.7 times the HUD total, so the colour column is the HUD total multiplied by the colour share of the raw draws, which makes it an estimate. With no flora at all, P1 balanced is still over every limit: about 1178 colour calls (limits 887 and 1000), 2117 or more total calls (limit 1924) and 592k triangles or more (limit 550k). Thinning `scatterDensity` or `carpetTufts`, the only remedy GR7 allows, cannot meet the limits, so neither was changed. V2's reference (`before/perf.md`, P1 noon: 1479 performance, 3207/593k balanced) was shot at the same pose with the same monster spawns. It has totals only, and its performance row (no shadow pass) stands in for the colour pass. Which remedy to take is open for the main session: merge the monster models (outside GR7's files) or have the owner amend the limit.
