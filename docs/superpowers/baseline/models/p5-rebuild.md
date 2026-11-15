# P5: full rebuild into scratch

Date: 2026-11-14. Branch `feat/models-pass`. Plan task P5. This is the fourth run, and a repair, at head `61657b6`. Runs one to three (`29ee250`, `267ffca`, `61657b6`) used Blender 5.0.1, whose exporter (v5.0.21) orders nodes and buffer views differently from the shipped files (v5.2.41); that caused the whole-file Drift on gear, monsters and world and the per-figure Brotli failures on five monsters. The 2% headroom of `99b9d01` was reverted in `f1ef3fa`; every ceiling is P4's measured value. This run uses Blender 5.2.4, whose exporter matches the shipped generator.

**Verdict: Accept is NOT met.** COMPARE(guard) exits 2, so "five compares exit 0" fails. Hero, gear, monsters and world rebuild byte-identical to the shipped files. COMPARE(guard) exits 2: the `CastleGuard` Brotli size is 18 bytes over its P4 ceiling, and the cause is the three-mesh guard Drift that P5 Accept itself allows (design 3.2). That residual needs an owner or plan amendment (below); it cannot be fixed inside P5's allowlist. Nothing shipped changed. Nothing was promoted.

## Environment

- Blender used: `Blender 5.2.4 LTS` (hash `cd5dc428cce1`, built 2026-11-10), at the git-ignored `scratch/blender52/blender-5.2.4-linux-x64/blender`. Downloaded from `download.blender.org/release/Blender5.2/`, SHA-256 `2fd14c50987426897ba60237ee996edf2b4151f4b1a72a460ca20be58c1d2d86` checked against the published value in run three; the tarball is no longer on disk, so the check was not repeated in this run. In run three the session's permission system refused to run this binary as a build; in this run it was allowed and ran.
- The BLEND command is the plan's, with `BLENDER_PATH` set to that binary instead of `/usr/bin/blender` (5.0.1).
- Every built file carries generator `Khronos glTF Blender I/O v5.2.41`, the same as the shipped files.
- Every command ran through `scripts/capped.sh` (allowlisted environment, 3 GB cap) with `timeout 600`, one Blender process at a time. `scratch/models-build/` was deleted and recreated first.

## Commands and results

`B=scratch/blender52/blender-5.2.4-linux-x64/blender` (absolute path in the run).

| Step | Command | Exit | Wall time |
|---|---|---|---|
| hashes before | `sha256sum public/models/*.glb blender/*.blend` | 0 | - |
| BLEND(all) | `scripts/capped.sh timeout 600 env BLENDER_PATH=$B node scripts/run-blender.mjs all --out scratch/models-build` | 0 | 15 s |
| BLEND(guard) | same, mode `guard` | 0 | 2 s |
| COMPARE(hero) | `node scripts/models-compare.mjs scratch/models-build/hero.glb public/models/hero.glb` | 0 | - |
| COMPARE(gear) | same pattern | 0 | - |
| COMPARE(monsters) | same pattern | 0 | - |
| COMPARE(guard) | same pattern | **2** | - |
| COMPARE(world) | same pattern | 0 | - |
| BLEND(hero), second run | same, mode `hero` | 0 | 2 s |
| BLEND(guard), second run | same, mode `guard` | 0 | - |
| hashes after | same `sha256sum` | 0 | - |
| UNTOUCHED | `git status --short public/models blender` | 0, prints nothing | - |
| SUITE | `scripts/capped.sh npx vitest run` | 0 (62 files, 550 tests) | 22 s |
| TYPES | `scripts/capped.sh npx tsc --noEmit` | 0, no output | - |
| BUILD | `scripts/capped.sh npm run build` | 0 | - |

Built sizes: `hero.glb` 216,844 bytes, `gear.glb` 2,331,560, `monsters.glb` 4,879,168, `world.glb` 2,776,656, `guard.glb` 1,705,360.

`cmp` of built against shipped prints nothing for `hero.glb`, `gear.glb`, `monsters.glb` and `world.glb`: all four are byte-identical to the shipped files.

## Compare reports (summaries)

| File | Exit | Contract | Budget | Drift |
|---|---|---|---|---|
| hero | 0 | pass | pass | zero |
| gear | 0 | pass | pass | zero |
| monsters | 0 | pass | pass | zero |
| guard | 2 | pass | **fail**: `CastleGuard` brotliBytes 1,174,334 > ceiling 1,174,316 | geometry bytes of `Plane.032`, `Circle.038`, `Circle.034`; file brotliBytes 1,174,350 -> 1,174,329 |
| world | 0 | pass | pass | zero |

## The guard residual

- The guard drift is the one design 3.2 found and P5 Accept allows: three meshes, POSITION by at most 1.2e-7 and NORMAL by at most 0.000222 (measured in run one on 5.0.1). `cmp -l` of the run-three 5.0.1 `guard.glb` against this 5.2.4 one lists 2 differing bytes, at offsets 72 and 74, both in the generator string (`5.0.21` -> `5.2.41`), so those figures hold for this build. Note that 0.000222 is slightly above the Accept's "within 0.00022"; the Accept's figure is design 3.2's rounding of the same drift.
- It does not depend on the Blender version: 5.0.1 and 5.2.4 both give `CastleGuard` 1,174,334 Brotli bytes. It is deterministic: a second BLEND(guard) is byte-identical to the first.
- P4 set the per-figure ceiling to the shipped file's measured value, 1,174,316. Any rebuild carries the allowed drift and lands 18 bytes over. So P5 Accept ("five compares exit 0" together with "Drift in the three guard meshes is allowed") and P4's ceiling cannot both hold for guard.
- Closing it needs an owner or plan amendment, outside P5's allowlist (`tests/fixtures/model-contract/guard.json` is P4's file): either raise the `CastleGuard` brotliBytes ceiling to at least 1,174,334, or let P5 accept a guard Budget fail of this cause. Slice 3 removes the guard file, so the ceiling only matters until then.

## Determinism

- Second BLEND(hero): `cmp` against the first `hero.glb` prints nothing; the whole file is byte-identical (and equals the shipped file).
- Second BLEND(guard): byte-identical to the first.

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
| five compares exit 0 | **four of five**: guard exits 2 (Budget, the residual above) |
| zero Contract differences | met (all five) |
| zero Drift apart from generator and the three guard meshes (within 0.00022) | met for hero, gear, monsters and world (zero Drift, byte-identical). Guard drifts only in the three meshes and the file Brotli size they move; its NORMAL drift is 0.000222, a hair above the stated 0.00022 |
| the two hash lists are equal | met |
| UNTOUCHED | met |
| second BLEND(hero) byte-identical binary chunk | met (whole file identical) |

Later slices that build with Blender should set `BLENDER_PATH` to a 5.2 binary. A 5.0.1 build reorders gear, monsters and world against the shipped files.
