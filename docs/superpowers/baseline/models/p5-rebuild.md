# P5: full rebuild into scratch

Date: 2026-11-14. Branch `feat/models-pass`. Plan task P5. This is the seventh run, at head `e5ae306`. It repairs the sixth run's record (commit `e5ae306`, run at head `e22fc78`), which wrongly said the guard NORMAL tolerance was met. It runs against P5's Accept as amended on 2026-11-15 in `57a2029`: the project builds with the installed Blender 5.0.1 (owner decision "C"); compares judge Contract and Budget; per-figure Brotli ceilings are the shipped value plus 2% (`scripts/models-manifest.mjs`); whole-file and buffer-order Drift is reported and accepted; the three guard meshes may drift by up to 1.2e-7 in POSITION and 0.000222 in NORMAL; a second build of the same file is byte-identical to the first.

Earlier runs: the sixth gave the same numbers as this one. One to three (`29ee250`, `267ffca`, `61657b6`) used 5.0.1 against the unamended Accept, and failed on drift and per-figure Brotli. Runs four and five (`296f8f8`, `b24c824`) used a downloaded 5.2.4, which the owner has since had deleted. It was not used or downloaded again in this run.

**Verdict: the amended Accept is met except one item, which misses by 1.5e-7.** `Circle.034`'s NORMAL drifts by 0.00022214651. The bound in the amended Accept is 0.000222, so this item is **not met**. The main session needs to amend the P5 Accept bound in the plan (outside this task's allowlist) to cover the measured value, for example 0.000223. The drift is the same on all seven runs, so no rebuild is needed after that change. Everything else is met: five builds exit 0 on 5.0.1, five compares exit 0 with zero Contract and zero Budget failures, POSITION drift is within 1.2e-7, the hash lists are equal, UNTOUCHED prints nothing, and a second BLEND(hero) is byte-identical to the first. Nothing shipped changed. Nothing was promoted.

## Environment

- Blender: `/usr/bin/blender`, `Blender 5.0.1`, the installed one, as the BLEND row of plan 0.2 names it.
- Every built file carries generator `Khronos glTF Blender I/O v5.0.21`. The shipped files carry `v5.2.41`.
- Every command ran through `scripts/capped.sh` (allowlisted environment, 3 GB cap). The Blender commands also ran under `timeout 600`, one Blender process at a time. `scratch/models-build/` was deleted and recreated first.

## Commands and results

| Step | Command | Exit | Wall time |
|---|---|---|---|
| hashes before | `sha256sum public/models/*.glb blender/*.blend` | 0 | - |
| BLEND(all) | `scripts/capped.sh timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs all --out scratch/models-build` | 0 | 10 s |
| BLEND(guard) | same, mode `guard` | 0 | 2 s |
| COMPARE(hero) | `node scripts/models-compare.mjs scratch/models-build/hero.glb public/models/hero.glb` | 0 | - |
| COMPARE(gear) | same pattern | 0 | - |
| COMPARE(monsters) | same pattern | 0 | - |
| COMPARE(guard) | same pattern | 0 | - |
| COMPARE(world) | same pattern | 0 | - |
| BLEND(hero), second run | same, mode `hero` | 0 | 3 s |
| hashes after | same `sha256sum` | 0 | - |
| UNTOUCHED | `git status --short public/models blender` | 0, prints nothing | - |
| SUITE | `scripts/capped.sh npx vitest run` | 0 (62 files, 550 tests) | 23 s |
| TYPES | `scripts/capped.sh npx tsc --noEmit` | 0, no output | - |
| BUILD | `scripts/capped.sh npm run build` | 0 | 7 s (vite) |

Built sizes: `hero.glb` 216,844 bytes, `gear.glb` 2,331,672, `monsters.glb` 4,879,064, `world.glb` 2,776,568, `guard.glb` 1,705,360.

All five built files differ from the shipped ones. `hero.glb` first differs at byte 72, which is the generator string (the size is the same). The other four also differ in buffer-view order, as the amended Accept expects.

## Compare reports (summaries)

| File | Exit | Contract | Budget | Drift |
|---|---|---|---|---|
| hero | 0 | pass | pass | generator only |
| gear | 0 | pass | pass | generator; rawBytes 2,331,560 -> 2,331,672; brotliBytes 668,121 -> 654,482 |
| monsters | 0 | pass | pass | generator; rawBytes 4,879,168 -> 4,879,064; brotliBytes 1,266,221 -> 1,273,402 |
| guard | 0 | pass | pass | generator; geometry bytes of `Plane.032`, `Circle.038`, `Circle.034`; brotliBytes 1,174,350 -> 1,174,329 |
| world | 0 | pass | pass | generator; rawBytes 2,776,656 -> 2,776,568; brotliBytes 489,842 -> 493,474 |

## Attribute drift, measured

Every mesh was matched by name, built against shipped, and the largest absolute difference was taken for each attribute of each primitive. No mesh was missing. In hero (18 meshes), gear (506), monsters (399) and world (433), every attribute value is equal: the bytes are only reordered. In the guard (27 meshes), only these differ:

| Mesh | POSITION | NORMAL |
|---|---|---|
| `Plane.032` | 1.19e-7 | 0.000210 |
| `Circle.038` | 2.98e-8 | 0.000112 |
| `Circle.034` | 5.96e-8 | 0.000222 (0.00022214651) |

POSITION is within 1.2e-7 for all three. NORMAL is within 0.000222 for `Plane.032` (0.00020962954) and `Circle.038` (0.00011226535). It is not within it for `Circle.034`: 0.00022214651 is 1.5e-7 over. Rounding is not a reason to pass it. It would be within 0.000223. No script checks this tolerance; it was measured with a throw-away script under `scratch/`. This is the drift design 3.2 found. It is the same value to every printed digit in runs one to seven, so it does not depend on the Blender version.

## Determinism

`cmp` of the second BLEND(hero) against the first `hero.glb` prints nothing, so the whole file is byte-identical.

## Hash lists

The before and after lists are equal (`diff` prints nothing), and they equal the earlier runs' lists:

```
92e8eb785b0b86bbcbc22d11462c53d493ef380e4946abc0f4f4567517cd678a  public/models/gear.glb
85fb16a371616238532278485c9520a2320132a3a75620467829050602eb5734  public/models/guard.glb
694f652b8471463a8eebb53cc9001d51e0d7544b8c028d8fc24fd64fa4351309  public/models/hero.glb
a4a4d00b355364d8b57baa35e15bb521c9ec420571f95002cd1a6ef3bd416fff  public/models/monsters.glb
0337e5bf869a4a8c50c46381a53aa5f835b62fdadfd4a9543107587ce2251500  public/models/world.glb
54579037d4c21693570e4b32ab933b8af0fe18b46cfacc5a270d2784490a2f32  blender/gear.blend
c6d962b9cb8e7a1f6960c691aef24de288654b8a6a40f4e18bfc6f5c2e065295  blender/hero.blend
0d24120bf81a63884a4b72317c3721277745a25dec883be29583f2712d3569f3  blender/monsters.blend
0a2cba253036642b1b5043dbc138b60efe364984b8470b7c2963404d11eb31b2  blender/world.blend
```

## Accept (amended 2026-11-15), item by item

| Item | Result |
|---|---|
| five builds exit 0 on 5.0.1 | met (BLEND(all) and BLEND(guard)) |
| five compares exit 0 on Contract and Budget, per-figure Brotli at shipped plus 2% | met (all five) |
| whole-file and buffer-order Drift reported and accepted | reported: generator on all five; buffer order and Brotli size on gear, monsters, world |
| three guard meshes within 1.2e-7 POSITION and 0.000222 NORMAL | POSITION met (largest 1.19e-7). NORMAL **not met**: `Circle.034` 0.00022214651 > 0.000222. Met if the main session amends the bound to 0.000223 |
| a second build of the same file is byte-identical | met (hero) |
| the two hash lists are equal; UNTOUCHED | met |
