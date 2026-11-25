# LT7b light: measured values

LT7b re-tunes LT7 after CP-LT (plan amendment, 2026-11-24). Measured the way LT7 measured: lossless PNG captures of the `balanced` tier, same run as the JPEGs here (bundle `index-B6-RUjqm.js`, NVIDIA GPU through `scripts/capture-gpu.mjs`; see `perf.md`). "Lum" is sRGB-encoded relative luminance, the measure `litGroundValue` uses. Each patch is the mean of a square of (2r+1)^2 pixels at the given 1280x720 coordinate. "LT7" is the LT7 bundle (`index-BAFaKfmp.js`) re-captured on the same GPU before any change: every patch matched LT7's SwiftShader numbers to within 0.1 (sky top at P5 night: 58.9 here, 54.8 on SwiftShader, the only larger difference), so the LT7 column is the LT7 picture.

## What changed

- `sky.ts`: the gradient's middle stop is `mix(uHorizon, uZenith, 0.5)`; it no longer reads `uFill`. No new uniform (`atmosphere.ts` untouched).
- `textures.ts`: the ground shader's albedo line multiplies the grass term by `GROUND_GRASS_GAIN` (new in `look.ts`, 3.0). The grass weight is about 0.6 on the P1 meadow (it shares the mix with the other biome weights), so the meadow's effective gain is about 2.2.
- `DAY_KEYS` exposure divided by 2.28 (the gain the meadow needs to keep its LT7 level): night 5.0 -> 2.9 (kept higher than 5.0/2.28 so the night lava keeps R >= 150), dawn 4.0 -> 1.75, morning 3.65 -> 1.6, noon 3.65 -> 1.6, golden 3.85 -> 1.69, dusk 4.2 -> 1.84. Zenith and horizon multiplied (linear) by the same exposure ratio, so the sky's pre-tone-map input at the top and the horizon is what LT7 had; hues unchanged.
- Unchanged: key and fill colours and intensities, the band constants (`ROUND_EDGE` and the rest in `materials.ts`), shadow bias and normal bias, the light logic, the texture filters.
- `tests/look-data.test.ts` (`litGroundValue` at albedo 0.3 >= 22% under every key, with no gain) and `tests/day-cycle.test.ts` (continuity, exposure at each key) pass with the new keys, untouched.

## Targets: LT7 and LT7b

| target | patch (xy, r) | LT7 | LT7b | pass |
|---|---|---|---|---|
| P1 noon lit meadow a 55-65 | 700,620, 12 | 60.1 | **58.3** | yes |
| P1 noon lit meadow b 55-65 | 1050,650, 12 | 59.6 | **57.7** | yes |
| P1 noon hero shadow 30-38 | 575,525, 3 | 35.1 | **33.7** | yes |
| P1 night lit meadow a >= 22 | 700,620, 12 | 25.3 | **30.2** | yes |
| P1 night lit meadow b >= 22 | 1050,650, 12 | 25.0 | **29.8** | yes |
| P1 noon sky top Lum <= 85 | 640,20, 10 | 94.0 | **70.6** | yes |
| P1 noon sky top B - R >= 20 | 640,20, 10 | 12 (234 241 246) | **57** (154 183 211) | yes |
| P5 noon ash 42-60 | 300,500, 6 | 71.6 | **48.8** | yes |
| P5 noon ash 42-60 | 900,600, 6 | 71.8 | **48.9** | yes |
| P5 noon lava G/R <= 0.65 | 300,150, 6 | 0.79 (254 200 101) | **0.59** (246 144 46) | yes |
| P5 night ash <= 30 | 300,500, 6 | 34.7 | **22.8** | yes |
| P5 night ash <= 30 | 900,600, 6 | 34.8 | **22.8** | yes |
| P5 night lava R >= 150 | 300,150, 6 | 205 | **163** | yes |
| P5 night lava G/R <= 0.55 | 300,150, 6 | 0.48 (205 99 23) | **0.39** (163 64 10) | yes |

The hero breathes, so the hero-shadow patch moves by a few levels between captures: three captures of this bundle gave 33.7, 36.7 and 33.7.

## Other patches (not targets)

| patch | P1 noon LT7 | LT7b | P1 golden LT7 | LT7b | P1 night LT7 | LT7b |
|---|---|---|---|---|---|---|
| lit meadow c (light patch) 330,450, 10 | 72.3 | 72.6 | 58.6 | 58.9 | 36.1 | 44.1 |
| lit meadow d (dark patch) 780,470, 8 | 42.2 | 40.9 | 29.0 | 27.8 | 14.7 | 18.1 |
| stall shadow 880,450, 6 | 20.5 | 19.8 | 28.9 | 27.7 | 3.4 | 5.1 |
| stall top (prop, no gain) 1000,315, 6 | 89.6 | 76.3 | 78.5 | 58.1 | 66.5 | 51.2 |
| sky top 640,20, 10 | 94.0 | 70.6 | 89.7 | 73.6 | 53.7 | 8.5 |

| patch | P5 noon LT7 | LT7b | P5 night LT7 | LT7b |
|---|---|---|---|---|
| sky top 640,20, 10 | 93.0 | 74.5 | 58.9 | 27.1 |

What this costs:

- **Props and figures are darker than in LT7** (the stall top 90 -> 76 at noon): they have no gain, and the exposure fell 2.28x. Their LT7 brightness came from the exposure that was compensating the meadow.
- **The night sky is a deep navy** (P1 sky top 8.5, B - R 44, stars visible) where LT7 had a pale blue band drawn from the fill (53.7). The night ground stays readable (meadow 30%).
- **The golden sky top is warm** (203 184 174) where LT7 had the fill's blue-white: the middle stop now sits between the warm golden horizon and the zenith.

## Acne, flicker, swim

- Acne: none seen on terrain, cliffs or props at P1 golden and P3 golden on `balanced`, `high` and `ultra` (P1 golden `ultra` and P3 golden `high` viewed at full size, the rest at half size; bias and normal bias unchanged from LT7).
- Band flicker: the band constants are LT7's; no band flip seen on the flat start-town ground in the P1 pictures (viewed at half size).
- Swim, P12 (running clock from the noon preset, `balanced`): the frames saved here (f00, f15, f29 of 30, 1.5 s apart) move the sun one 0.5-degree step per frame on this GPU (the clock runs at real speed here, which SwiftShader did not). A burst of 30 frames 0.2 s apart, crop around the anvil's shadow (400,325 to 500,372, 4700 px): consecutive frames differ by 0 pixels except at the stepped-sun moves, every 4 to 5 frames, 75 to 114 pixels each; an open meadow crop (100,600 to 300,700, 20000 px) never changes. Shadow edges hold still between steps: no swim.
- Texel magnification and texture filters: unchanged.
