# P5: full rebuild into scratch

Date: 2026-11-14. Branch `feat/models-pass`. Plan task P5. This is the third run, and a repair. The first run was at head `256522d` (record in `29ee250`). The second run was at `99b9d01`, which gave the per-figure `brotliBytes` ceilings 2% headroom. That commit changed `scripts/models-manifest.mjs` and three manifests, which are outside P5's allowlist (rule 0.3.1). It also went against P4, which says the first ceiling is today's measured value. So `f1ef3fa` reverts it: every ceiling is back at exactly what P4 measured. This run is at `f1ef3fa`.

**Verdict: Accept is NOT met.** On Blender 5.0.1, the only Blender this run was allowed to run, two compares exit 2 (Budget, on per-figure Brotli bytes), and gear, monsters and world drift in whole-file bytes. Contract passes everywhere. Nothing shipped changed. The hero build is deterministic. Nothing was promoted, and nothing in this record amends the plan.

## Environment

- Blender used: `Blender 5.0.1` (`/usr/bin/blender`, the plan's BLEND command). Built files carry generator `Khronos glTF Blender I/O v5.0.21`. Shipped files carry `v5.2.41`.
- A Blender 5.2 build was tried and blocked. `blender-5.2.4-linux-x64.tar.xz` was downloaded from `download.blender.org/release/Blender5.2/`. It matched the published SHA-256 `2fd14c50987426897ba60237ee996edf2b4151f4b1a72a460ca20be58c1d2d86` and was extracted under the git-ignored `scratch/blender52/`. Its glTF exporter is version `(5, 2, 41)`, the same as the shipped files. Only `--version` ran (`Blender 5.2.4 LTS`). The session's permission system then refused to run it as a build, so no 5.2 build exists.
- Every command ran through `scripts/capped.sh` (allowlisted environment, 3 GB cap) with `timeout 600`, one Blender process at a time. `scratch/models-build/` was emptied first.

## Commands and results

| Step | Command | Exit | Wall time |
|---|---|---|---|
| hashes before | `sha256sum public/models/*.glb blender/*.blend` | 0 | - |
| BLEND(all) | `scripts/capped.sh timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs all --out scratch/models-build` | 0 | 10 s |
| BLEND(guard) | same, mode `guard` | 0 | 1 s |
| COMPARE(hero) | `node scripts/models-compare.mjs scratch/models-build/hero.glb public/models/hero.glb` | 0 | - |
| COMPARE(gear) | same pattern | 0 | - |
| COMPARE(monsters) | same pattern | **2** | - |
| COMPARE(guard) | same pattern | **2** | - |
| COMPARE(world) | same pattern | 0 | - |
| BLEND(hero), second run | same, mode `hero` | 0 | 2 s |
| hashes after | same `sha256sum` | 0 | - |
| UNTOUCHED | `git status --short public/models blender` | 0, prints nothing | - |
| SUITE | `scripts/capped.sh npx vitest run` | 0 (62 files, 550 tests) | 23 s |
| TYPES | `scripts/capped.sh npx tsc --noEmit` | 0, no output | - |
| BUILD | `scripts/capped.sh npm run build` | 0 | 3 s |

Built sizes: `hero.glb` 216,844 bytes, `gear.glb` 2,331,672, `monsters.glb` 4,879,064, `world.glb` 2,776,568, `guard.glb` 1,705,360.

## Compare reports (summaries)

| File | Exit | Contract | Budget | Drift |
|---|---|---|---|---|
| hero | 0 | pass | pass | generator only |
| gear | 0 | pass | pass | generator; rawBytes 2,331,560 -> 2,331,672; brotliBytes 668,121 -> 654,482 |
| monsters | 2 | pass | **fail** (below) | generator; rawBytes 4,879,168 -> 4,879,064; brotliBytes 1,266,221 -> 1,273,402 |
| guard | 2 | pass | **fail** (below) | generator; geometry bytes of `Plane.032`, `Circle.038`, `Circle.034`; brotliBytes 1,174,350 -> 1,174,329 |
| world | 0 | pass | pass | generator; rawBytes 2,776,656 -> 2,776,568; brotliBytes 489,842 -> 493,474 |

Budget failures, built Brotli bytes against the P4 ceiling:

- `Monster_goblin` 75,463 > 74,168
- `Monster_goblin_archer` 63,884 > 63,774
- `Monster_hill_giant` 64,922 > 64,905
- `Monster_moss_guardian` 58,552 > 58,523
- `Monster_scorpion` 84,340 > 84,031
- `CastleGuard` 1,174,334 > 1,174,316

## Why it differs (from the first two runs, sizes unchanged here)

- **hero**: the binary chunk is byte-identical to the shipped one. The JSON differs only in `asset.generator`.
- **gear, monsters, world**: every mesh's attribute and index bytes equal those of the shipped mesh with the same name (0 differences over 506, 399 and 433 meshes). The node, mesh and material sets are equal, but in a different order (exporter 5.0.21 against 5.2.41). That reorder moves the JSON length (rawBytes), and through buffer-view order it moves each file's and each figure's Brotli size.
- **guard**: the order equals the shipped file. Three meshes differ in content: POSITION by at most 1.2e-7 and NORMAL by at most 0.000222, which is the Drift design 3.2 found. The `CastleGuard` Brotli size moves 18 bytes past its ceiling as a result.
- Builds are deterministic run to run (see below). The difference comes from the exporter version.

## What closes the task (needs someone with authority; not granted here)

Either:

1. **Build on Blender 5.2.** Allow the verified 5.2.4 binary at `scratch/blender52/blender-5.2.4-linux-x64/blender` to run, then rerun P5 with that path as `BLENDER_PATH`. Its exporter matches the shipped generator. Or:
2. **An owner or plan amendment** to P5 Accept, and to the P4 ceilings, that accepts export-order Drift and Brotli movement for Blender 5.0.1 builds against the 5.2.41 shipped files.

## Determinism

Second BLEND(hero): `cmp` of the first and second `hero.glb` prints nothing, so the whole file is byte-identical.

## Hash lists

The before and after lists are equal (`diff` prints nothing). They also equal the earlier runs' lists:

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
| five builds exit 0 | met |
| five compares exit 0 | **not met**: monsters and guard exit 2 (Budget) |
| zero Contract differences | met (all five) |
| zero Drift apart from generator and the three guard meshes (within 0.00022) | **not met**: gear, monsters and world drift in whole-file rawBytes and brotliBytes. Guard's file brotliBytes also moves |
| the two hash lists are equal | met |
| UNTOUCHED | met |
| second BLEND(hero) byte-identical binary chunk | met (whole file identical) |

If a later slice promotes a `monsters.glb`, `gear.glb` or `world.glb` built on 5.0.1, it also reorders the shipped file. Nobody has checked whether the engine depends on node order.
