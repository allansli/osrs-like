# GR8: ground and air fixes after CP-GR

Plan task GR8 (amendment 2026-11-24). Four defects seen at P1, P7 and P8 (noon, balanced) in the GR7 pictures. For each: the cause found first, the fix at that cause, and the target's value before (GR7) and after (GR8).

## How the values are measured

Lossless PNG captures of the `balanced` tier on the NVIDIA GPU (`scripts/capture-gpu.mjs`, ANGLE over D3D12, RTX 4070 Laptop), 1280x720, seeded `Math.random`, cleared storage, skills at 99, mouse parked on `#top-left-hud`, the same poses as the pictures here. "Before" is the GR7 head (3ea3660, bundle `index-CqADpu7g.js`, GR7's world code plus the UI lane merge a7296f6, which touches no world rendering; its P1 noon numbers match GR7's). "After" is the GR8 bundle (`index-M8HWa8Lt.js`, 07fa27f). A patch `x,y,r` is the mean of the (2r+1)^2 pixels around that point; a rect `x0,y0-x1,y1` is the mean of every pixel in it. "Lum" is sRGB-encoded relative luminance in percent, as in `light/values.md`.

## 1. The noon sky reads near white: fixed

**Cause.** Not the dome. LT7b's target point (640,20) still holds on the GR7 head: Lum 70.6, RGB 155 184 212, B - R 57. The pale, faceted shapes in the upper half of the P1 picture are the horizon apron (design 6.4), not sky. Hiding the apron in the capture drops the patch at (640,90) from 90.7 to 75.4 (the dome behind it); hiding the clouds changes nothing at either patch. The apron is a `cut` facet material whose colour `sky.ts` sets to the air colour every frame. The facet shader lights it with the key and fill, and the exposure raises it, so the air colour (`#a8c6e0` at noon) renders near white, brighter than the sky behind the hills.

**Fix.** `sky.ts`: the apron's albedo is `APRON_ALBEDO` (0.45) times the air colour. It still follows the air colour at every phase, so its hue and the horizon haze stay those of design 6.3. `AIR_GLSL`, the dome shader and its air weight are unchanged.

| target (P1 noon) | patch | GR7 | GR8 | pass |
|---|---|---|---|---|
| sky top Lum <= 85 | 640,20, 10 | 70.6 | 70.6 | yes |
| sky top B - R >= 20 | 640,20, 10 | 57 (155 184 212) | 57 (155 184 212) | yes |
| upper sky over the apron, Lum <= 85 | 640,90, 10 | **90.7** (223 233 239) | 78.9 (185 204 218) | yes |
| upper sky over the apron, B - R >= 20 | 640,90, 10 | 16 | 33 | yes |
| apron at the right, Lum | 1100,40, 10 | 83.2 (197 215 229) | 72.7 (164 189 210) | |
| apron hidden (the dome alone) | 640,90, 10 | 75.4 | | |

The LT7b meadow patches did not move with GR8: P1 noon meadow a (700,620, 12) 54.7 before and after, meadow b (1050,650, 12) 44.8 before and after. They are lower than LT7b's 58.3 and 57.7 because GR6's carpet now covers those patches; GR8 does not change that.

## 2. The woods floor reads bright meadow green: fixed for the ground; the carpet is unchanged

**Cause.** In the terrain, `getBiomeColor` gives every woods vertex `BIOME_COLORS.canopy` (`#16a34a`, linear 0.008 0.37 0.07), a saturated green. In the ground shader, `grassW` includes the canopy weight, so the woods take the meadow's grass gain (`GROUND_GRASS_GAIN` 3.0, LT7b); `korokBiome` mixes in the moss texture only south of z = -4 to -18 and at about 0.7 at Lampwright's Hollow. `color_fragment` then multiplies the canopy vertex colour in after this chunk. The result: a woods floor brighter than the meadow (Lum 72 against 40.5) and greener than any region.

**Fix.** `textures.ts`, the ground shader's woods weight and tint: a woods share `woodsW`, taken from how far the vertex colour is toward `uCanopy` (green minus red, which is linear in the vertex blend), saturated at halfway. That share replaces the albedo with the moss texture times a dark blue-green tint (`vec3(0.022, 0.06, 0.075)`), divided by the vertex colour so the colour multiplied in afterwards cancels. Outside the woods `woodsW` is 0 and nothing changes (the meadow patches above are identical). The region edge blends without a bright fringe.

| target (P8 noon) | patch | GR7 | GR8 | pass |
|---|---|---|---|---|
| woods ground, right foreground | rect 800,580-1270,715 | 72.1 (133 207 106) | 31.2 (36 95 58) | |
| woods ground, left foreground | rect 200,560-450,715 | 59.5 (106 173 77) | 32.0 (39 98 49) | |
| woods ground, patch | 1000,650, 12 | 77.1 (140 222 115) | 32.4 (35 98 64) | |
| P1 noon meadow, same kind of rect | rect 200,600-500,715 | 40.5 (77 117 43) | 40.5 (77 117 43) | |
| woods at least 15% below the meadow (<= 34.4) | the two woods rects against the meadow rect | +78% and +47% (brighter) | -23% and -21% | yes |
| bluer and greener than the meadow | B/R and G/R of the rects | woods B/R 0.80, G/R 1.56; meadow 0.56, 1.52 | woods B/R 1.61 and 1.26, G/R 2.64 and 2.51 | yes |

The carpet is not changed. Its tints are per variant (`CARPET_TINTS` in `floraKit.ts`), shared by every region, and the woods carpet is the tuft and tussock variants chosen by `CARPET_WEIGHTS` in `flora.ts`, outside GR8's files. At P8 it reads as brown tussocks and dark tufts over the moss, not bright green; darkening a variant's tint would also darken the meadow.

## 3. The woods-tree crowns read near black at noon: raised, but the 18% target is not met

**Cause.** GR5's fix (a5eb463) set the crown colours to an sRGB HSL lightness of 0.085 to 0.125 to stay below the yew's "about 0.148". HSL lightness is the wrong measure for that comparison: the yew's crown is `0x223628` times the grass texture (linear mean 0.705 0.899 0.324), a saturated green with a linear albedo luminance of 0.0266, while the woods crowns at that lightness have a luminance of 0.009 to 0.017, a third to two thirds of the yew's. At P8 the camera looks toward the sun (shadows fall toward the viewer), so the crown faces it sees are the unlit ones, lit only by the fill and bounce, and those render at 2.3 to 3.7%.

**Fix.** `floraKit.ts`, the crown lightness only: 0.135 and 0.15 (lower cone), 0.14 and 0.155 (upper cone), which gives every vertex a linear luminance of 0.020 to 0.025, below the yew's 0.0266. Hue unchanged, still 0.04 less saturated than the wood family's crown.

| target | patch | GR7 | GR8 | pass |
|---|---|---|---|---|
| P8 noon crown, mean Lum >= 18 | 640,120, 12 | 2.3 (2 7 5) | 5.5 (4 17 12) | **no** |
| | 790,120, 10 | 2.5 (2 8 6) | 5.8 (5 18 13) | **no** |
| | 1070,140, 10 | 3.7 (4 11 10) | 6.9 (7 21 16) | **no** |
| darker than the yew crown, same light (hero at -90,-24, yaw 0, toward the sun) | yew 1050,210, 10 and 920,230, 8: 10.9 and 8.6 | woods 520,150 2.3; 230,180 3.3; 750,140 4.9 | woods 5.4; 6.5; 7.9 | yes |
| darker than the yew crown, same light (yaw 4.712, sun to the side) | yew 600,140, 8 and 580,210, 6: 21.5 and 20.8 | woods 340,200 6.6; 760,200 7.5; 920,120 10.0 | woods 12.9; 14.8; 16.4 | yes |
| albedo luminance below the yew's 0.0266 | vertex colours | 0.009 to 0.017 | 0.020 to 0.025 | yes |
| visible facet bands at P8 noon | | one band per face seen (all unlit) | the same | **no** |

**The two crown targets conflict.** Under the light at P8 noon, the yew's own crown renders at 8.6 to 16.3% (yaw 0, the same backlight), so a woods crown that stays darker than the yew cannot reach a mean of 18% there, and no tint or lightness can give it visible bands when every face the camera sees is unlit. Meeting 18% would need a crown albedo about three times the yew's, which breaks design 5.6's rule that a woods tree's crown is darker than any harvestable tree. GR8 keeps the rule and records the target as missed. Lifting the unlit faces is a light-model change (fill or bounce), which GR8 must not touch; the main session decides.

## 4. The desert carpet shows a regular grid at P7: not fixed, the cause is outside GR8's files

**Cause.** `src/engine/flora.ts`, `CARPET_VERTEX`, lines 289 and 290: instance `i` of variant `v` takes cell `k = 4i + v` of a row-major grid `uCarpetGrid` cells wide (`buildCarpet`, line 357: `floor(sqrt(carpetTufts))`, 77 on balanced). Variant `v` therefore owns the cells where `x + 77y` is congruent to `v` mod 4; since 77 is 1 mod 4, those are the cells on every fourth anti-diagonal (`x + y` congruent to `v`). The desert's carpet is almost all one variant (the tussock: weight 1 in the dry family, the tuft 0.3 and ember grass 0.1), so the tussocks stand on parallel diagonal lines 4 cells apart along each axis, about 1.41 units apart across the lines. The jitter (line 293, `0.15 + 0.7 * hash` of a 0.5-unit cell) moves a tuft at most 0.35 units, a quarter of that spacing, so it cannot break the lines. On high and ultra the grid is 118 and 154 cells wide (2 mod 4), which gives a different but still periodic layout.

**Not fixed.** GR8's files allow "`src/state/scatter.ts`: carpet jitter only", but `scatter.ts` holds no carpet code: it places the kit pieces only. The carpet's placement and jitter are in `flora.ts`, which GR8 may not touch. A fix there would hash the variant per cell instead of interleaving it by index (for example: every instance of every variant covers every cell, and a cell keeps the variant a per-cell hash picks), or permute the instance index before the modulo; either is a change to GR6's shader and needs its own task.

| target | GR7 | GR8 | pass |
|---|---|---|---|
| P7 noon and golden: no row or column of tufts visibly aligned | diagonal lines across the whole desert floor | unchanged | **no** |

## Summary

| defect | target | result |
|---|---|---|
| 1 noon sky near white | sky top Lum <= 85 and B - R >= 20, horizon haze kept | met; the cause was the apron, now 0.45 of the air colour |
| 2 woods floor meadow green | P8 woods ground >= 15% below the P1 meadow, bluer and greener | met for the ground (-21% to -23%); the carpet is per variant and unchanged |
| 3 woods crowns near black | mean crown Lum >= 18 with visible bands, darker than the yew | darker than the yew: met; crown Lum raised from 2.3-3.7 to 5.5-6.9; 18% and bands: not met, in conflict with the yew rule under P8's backlight |
| 4 desert carpet grid | no aligned rows at P7 | not met: the cause is in `flora.ts`, outside GR8's files |

P1 balanced calls and triangles stay within 5% of GR7 (`perf.md`).
