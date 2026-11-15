# P5: full rebuild into scratch

Date: 2026-11-14. Branch `feat/models-pass`. Plan task P5. This is the fifth run, at head `a3cb54f`, against the plan as amended in `3088e29` (the BLEND row of section 0.2 names a 5.2 Blender; the `CastleGuard` Brotli ceiling in `tests/fixtures/model-contract/guard.json` is 1,174,334 and the NORMAL tolerance of the three guard meshes is 0.000222).

Earlier runs: one to three (`29ee250`, `267ffca`, `61657b6`) used Blender 5.0.1, whose exporter (v5.0.21) orders nodes and buffer views differently from the shipped files (v5.2.41). Run four (`296f8f8`) used 5.2.4 and failed only on the guard's per-figure Brotli ceiling, 18 bytes under every rebuild, which the amendment closed.

**Verdict: Accept is met.** Five builds exit 0, five compares exit 0, zero Contract differences, hero, gear, monsters and world rebuild byte-identical, the guard drifts only in the three meshes design 3.2 found (NORMAL at most 0.000222, POSITION at most 1.2e-7), the hash lists are equal, UNTOUCHED prints nothing, and a second BLEND(hero) is byte-identical. Nothing shipped changed. Nothing was promoted.

## Environment

- Blender used: `Blender 5.2.4 LTS`, build date 2026-11-10, at the git-ignored `scratch/blender52/blender-5.2.4-linux-x64/blender`. It came from `download.blender.org/release/Blender5.2/`; the tarball's SHA-256 `2fd14c50987426897ba60237ee996edf2b4151f4b1a72a460ca20be58c1d2d86` was checked against the published value in run three. The tarball is no longer on disk; the extracted executable's SHA-256 in this run is `9c12ad1b09401dcd3a8a5336279bca91455f15023aa0e5e4cb5cdb7b116a09f1`. Nothing was downloaded in this run.
- The BLEND command is the plan's, with `BLENDER_PATH` set to that binary.
- Every built file carries generator `Khronos glTF Blender I/O v5.2.41`, the same as the shipped files.
- Every command ran through `scripts/capped.sh` (allowlisted environment, 3 GB cap), the Blender ones with `timeout 600`, one Blender process at a time. `scratch/models-build/` was deleted and recreated first.

## Commands and results

`B=scratch/blender52/blender-5.2.4-linux-x64/blender` (absolute path in the run).

| Step | Command | Exit | Wall time |
|---|---|---|---|
| hashes before | `sha256sum public/models/*.glb blender/*.blend` | 0 | - |
| BLEND(all) | `scripts/capped.sh timeout 600 env BLENDER_PATH=$B node scripts/run-blender.mjs all --out scratch/models-build` | 0 | 10 s |
| BLEND(guard) | same, mode `guard` | 0 | 2 s |
| COMPARE(hero) | `node scripts/models-compare.mjs scratch/models-build/hero.glb public/models/hero.glb` | 0 | - |
| COMPARE(gear) | same pattern | 0 | - |
| COMPARE(monsters) | same pattern | 0 | - |
| COMPARE(guard) | same pattern | 0 | - |
| COMPARE(world) | same pattern | 0 | - |
| BLEND(hero), second run | same, mode `hero` | 0 | 2 s |
| hashes after | same `sha256sum` | 0 | - |
| UNTOUCHED | `git status --short public/models blender` | 0, prints nothing | - |
| SUITE | `scripts/capped.sh npx vitest run` | 0 (62 files, 550 tests) | 22 s |
| TYPES | `scripts/capped.sh npx tsc --noEmit` | 0, no output | - |
| BUILD | `scripts/capped.sh npm run build` | 0 | 6 s |

Built sizes: `hero.glb` 216,844 bytes, `gear.glb` 2,331,560, `monsters.glb` 4,879,168, `world.glb` 2,776,656, `guard.glb` 1,705,360.

`cmp` of built against shipped prints nothing for `hero.glb`, `gear.glb`, `monsters.glb` and `world.glb`: all four are byte-identical to the shipped files. `guard.glb` first differs at byte 7376 (geometry of the three meshes below).

## Compare reports (summaries)

| File | Exit | Contract | Budget | Drift |
|---|---|---|---|---|
| hero | 0 | pass | pass | zero |
| gear | 0 | pass | pass | zero |
| monsters | 0 | pass | pass | zero |
| guard | 0 | pass | pass (`CastleGuard` 1,174,334 = amended ceiling) | geometry bytes of `Plane.032`, `Circle.038`, `Circle.034`; file brotliBytes 1,174,350 -> 1,174,329 |
| world | 0 | pass | pass | zero |

## Guard drift, measured

Largest absolute difference per attribute, built against shipped, over every primitive (every other attribute of every mesh is equal):

| Mesh | POSITION | NORMAL |
|---|---|---|
| `Plane.032` | 1.19e-7 | 0.000210 |
| `Circle.038` | 2.98e-8 | 0.000112 |
| `Circle.034` | 5.96e-8 | 0.000222 (0.00022214651) |

All within the amended tolerance of 0.000222. This is the drift design 3.2 found; it is deterministic and does not depend on the Blender version (runs one to four measured the same).

## Determinism

Second BLEND(hero): `cmp` against the first `hero.glb` prints nothing; the whole file, and so its binary chunk, is byte-identical (and equals the shipped file).

## Hash lists

The before and after lists are equal (`diff` prints nothing), and equal to the earlier runs' lists:

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

## Accept, item by item

| Item | Result |
|---|---|
| five builds exit 0 | met (BLEND(all) and BLEND(guard)) |
| five compares exit 0 | met |
| zero Contract differences | met (all five) |
| zero Drift apart from generator and the three guard meshes (within 0.000222, amended) | met: hero, gear, monsters and world byte-identical, generator equal; guard drifts only in the three meshes and the file Brotli size they move |
| the two hash lists are equal | met |
| UNTOUCHED | met |
| second BLEND(hero) byte-identical binary chunk | met (whole file identical) |

Later slices that build with Blender should set `BLENDER_PATH` to a 5.2 binary. A 5.0.1 build reorders gear, monsters and world against the shipped files.
