# LT7 light: measured values

Measured on lossless PNG captures of the `balanced` tier (same run as the JPEGs here, bundle `index-BAFaKfmp.js`). "Lum" is sRGB-encoded relative luminance, the measure `litGroundValue` uses; "V" is HSV value. Each patch is the mean of a square of (2r+1)^2 pixels at the given 1280x720 coordinate. The meadow's albedo varies about 3x across P1, so every patch is listed, not only the ones that pass.

## What changed (constants only)

- `DAY_KEYS`: key intensity x0.475 and exposure x3.65 (night x4, moon key 0.35 -> 0.5): night 0.5 / 5.0, dawn 0.43 / 4.0, morning 0.76 / 3.65, noon 0.95 / 3.65, golden 0.81 / 3.85, dusk 0.38 / 4.2. Zenith and horizon lowered in value by the exposure ratio (linear), hue unchanged (within 6 degrees), so the sky's top and horizon receive the same pre-tone-map input as before.
- `SHADOW_NORMAL_BIAS` 0.02 -> 0.08 (bias unchanged at -0.0004): removes the acne stripes seen at P3 golden and P1 dusk on the `high` tier; feet and stall still touch their shadows at P1 noon `ultra`.
- `ROUND_EDGE` 0.35 -> 0.30: the golden preset (phase 0.70) puts the sun at sin(elevation) 0.357, on the old edge, so flat start-town ground (the terrain compiles the two-band branch) flipped band triangle by triangle. At 0.30 flat ground at golden is fully in the lit band.

Why exposure: the P1 meadow albedo is dark (about 0.04 to 0.06 linear in green, fitted from lit/shadow pairs; the model `albedo x (key x band + fill + 0.04) x exposure` through three's ACES curve reproduces the measured pairs to within a few levels). Shadows in the ACES toe are crushed, so a 30 to 38% shadow needs fill x exposure about 3.6x higher, and the lit/shadow ratio of 1.7 needs the key lowered.

## P1 noon (target: lit 55-65, shadow 30-38)

| patch | xy, r | before tune (Lum) | after: rgb | V | Lum |
|---|---|---|---|---|---|
| lit meadow a | 700,620, 12 | 38.4 | 133 163 87 | 64.0 | **60.1** |
| lit meadow b | 1050,650, 12 | 38.1 | 130 163 80 | 63.8 | **59.6** |
| lit meadow c (light patch) | 330,450, 10 | 51.5 | 165 195 114 | 76.4 | 72.3 |
| lit meadow d (dark patch by the stall) | 780,470, 8 | 23.9 | 80 118 41 | 46.4 | 42.2 |
| shadow of the hero (on meadow like a/b) | 575,525, 3 | 13.9 | 56 99 51 | 39.0 | **35.1** |
| shadow of the stall (on meadow like d) | 880,450, 6 | 5.5 | 26 60 22 | 23.4 | 20.5 |
| stall top (bright prop) | 1000,315, 6 | 77.3 | 236 229 200 | 92.5 | 89.6 |
| sky, top of frame | 640,20, 10 | 77.4 | 234 241 246 | 96.6 | 94.0 |

Pairs on the same albedo: a/b with the hero's shadow 60 / 35 (ratio 1.7, on target); d with the stall's shadow 42 / 20.5 (ratio 2.1; this darker patch sits below the band).

## P1 golden and night

| patch | golden Lum | night Lum (target lit >= 22) |
|---|---|---|
| lit meadow a | 45.3 | **25.3** |
| lit meadow b | 44.8 | **25.0** |
| lit meadow c | 58.6 | 36.1 |
| lit meadow d | 29.0 | 14.7 |
| hero-shadow patch (lit at golden: the shadow falls elsewhere) | 46.3 | 10.5 |
| stall-shadow patch | 28.9 | 3.5 |
| sky top | 89.7 | 53.7 |

Before the tune, night lit meadow a was 4.9%.

## P5 (wilderness) before and after this tune, balanced

| patch | noon before | noon after | night before | night after |
|---|---|---|---|---|
| ash ground 300,500 | 50.4 | 71.7 | 8.3 | 34.8 |
| ash ground 900,600 | 50.5 | 71.8 | 8.4 | 34.9 |
| lava band 300,150 (rgb) | 250 149 50 | 254 200 101 | 81 22 2 | 205 99 23 |
| sky top 640,20 | 78.6 | 93.0 | 23.5 | 54.8 |

"Before" here is the head before LT7 (LT6), not `before/`, which is `main` with the old light model.

## Costs of meeting the P1 targets (for CP-LT)

- **Pale noon sky.** The sky's middle band is drawn from the fill colour (`sky.ts`, `mix(uHorizon, uFill, ...)`), and the fill x exposure that lifts the shadows to 30 to 38% brightens that band the same way: sky top 77 -> 94% at noon. Zenith and horizon were compensated; the fill cannot be, because it is the shadow light. A fix is outside this task's files: let the sky divide its fill term by the exposure, or give the sky its own mid colour.
- **Bright regions and emissives scale with exposure.** P5 ash 50 -> 72% at noon and the lava shifts from orange toward yellow under ACES; at night lava and other emissives are about 4x brighter (P5 night lava 81,22,2 -> 205,99,23). The root cause is the P1 meadow albedo: a meadow twice as bright would halve the exposure needed. Meadow albedo (vertex colours and the grass texture) is outside LT7's allowlist.
- `facetBlend` (0.7) is a literal in `textures.ts`, outside the allowlist; it was not needed.

## Acne, flicker, swim

- Acne: none on terrain or cliffs at P1 golden/dusk and P3 golden on `balanced`, `high` and `ultra` after the normal-bias change (stripes were visible on `high` at 0.02).
- Band flicker on flat start-town ground: the preset that sat on an edge (golden, 0.357 vs 0.35) is cleared by 0.057; noon (0.87) and night are far from every edge.
- P12, running clock at P1 noon, `balanced`, 30 frames 1.5 s apart (about 110 s wall time; the clock runs at the software renderer's frame rate): in a static crop around the forge's shadow (7800 px), consecutive frames differ by 0 pixels except at the stepped-sun moves, every third frame, 54 to 96 pixels each; an open meadow crop (20000 px) never changes; the obelisk base changes by at most 5 px. Shadow edges hold still between 0.5-degree steps and move in discrete steps: no swim. Frames f00, f15, f29 are saved here. Walking 30 units was not driven (no click on the canvas in a capture run).
- Texel magnification and texture filters: unchanged.
