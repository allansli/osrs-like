# P5: full rebuild into scratch

Date: 2026-11-14. Branch `feat/models-pass`, head before this record `256522d`. Plan task P5.

**Verdict: Accept is NOT met.** The pipeline is safe (nothing shipped changed, builds are deterministic, every Contract check passes), but two of the five compares exit 2 (Budget), and Drift shows more than the generator string and the three guard meshes. Cause and the fix it needs are below. Nothing was promoted.

## Environment

- Blender: `Blender 5.0.1` (`/usr/bin/blender`). Built files carry generator `Khronos glTF Blender I/O v5.0.21`; shipped files carry `Khronos glTF Blender I/O v5.2.41`.
- Every command ran through `scripts/capped.sh` (allowlisted environment, 3 GB cap), one Blender process at a time, `timeout 600`.

## Commands and results

| Step | Command | Exit | Wall time |
|---|---|---|---|
| hashes before | `sha256sum public/models/*.glb blender/*.blend` | 0 | - |
| BLEND(all) | `scripts/capped.sh timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs all --out scratch/models-build` | 0 | 16 s (hero, gear, monsters, world) |
| BLEND(guard) | same, mode `guard` | 0 | 3 s |
| COMPARE x5 | `node scripts/models-compare.mjs scratch/models-build/<name>.glb public/models/<name>.glb` | see below | - |
| BLEND(hero), second run | same, mode `hero` | 0 | 4 s |
| hashes after | same `sha256sum` | 0 | - |
| UNTOUCHED | `git status --short public/models blender` | 0, prints nothing | - |

The hero build logs `Unable to pack file` for the Kai textures and for `/Users/kevinrodriguez/Desktop/front.jpg` (the author's path inside the source `.blend`, design 3.2 and 11). It exits 0 and its GLB matches the shipped one.

Built outputs, all under `scratch/models-build/`: `hero.glb` 216,844 bytes, `gear.glb` 2,331,672, `monsters.glb` 4,879,064, `world.glb` 2,776,568, `guard.glb` 1,705,360, plus `hero.blend`, `gear.blend`, `monsters.blend`, `world.blend` and `kai/`. These are the sizes design 3.2 measured.

## Compare reports (summaries)

| File | Exit | Contract | Budget | Drift |
|---|---|---|---|---|
| hero | 0 | pass | pass | generator only |
| gear | 0 | pass | pass | generator; rawBytes 2,331,560 -> 2,331,672; brotliBytes 668,121 -> 654,482 |
| monsters | **2** | pass | **5 FAIL** | generator; rawBytes 4,879,168 -> 4,879,064; brotliBytes 1,266,221 -> 1,273,402 |
| guard | **2** | pass | **1 FAIL** | generator; geometry bytes of `Plane.032`, `Circle.038`, `Circle.034`; brotliBytes 1,174,350 -> 1,174,329 |
| world | 0 | pass | pass | generator; rawBytes 2,776,656 -> 2,776,568; brotliBytes 489,842 -> 493,474 |

Budget failures, all per-figure `brotliBytes` (built against the ceiling in the live manifest):

| Figure | Built | Ceiling | Over |
|---|---|---|---|
| `Monster_goblin` | 75,463 | 74,168 | +1,295 (1.7%) |
| `Monster_goblin_archer` | 63,884 | 63,774 | +110 |
| `Monster_hill_giant` | 64,922 | 64,905 | +17 |
| `Monster_moss_guardian` | 58,552 | 58,523 | +29 |
| `Monster_scorpion` | 84,340 | 84,031 | +309 |
| `CastleGuard` | 1,174,334 | 1,174,316 | +18 |

Triangles, meshes, materials, raw bytes and every file-level ceiling pass.

## Why: export order, not content

Checked with a throw-away script against `scripts/lib/glb.mjs`, matching meshes by name:

- **hero**: the binary chunk is byte-identical to the shipped one (SHA-256 `36439a43...b69ae`, 176,192 bytes). JSON differs only in `asset.generator`.
- **gear, monsters, world**: every mesh's attribute and index bytes are identical to the shipped mesh of the same name (0 differences over 506, 399 and 433 meshes). The node, mesh and material **sets** are equal, but their **order** differs: Blender 5.0.1's exporter writes them in a different order from 5.2.41 (gear's first node is `Gear_scimitar_01_gear_primary` built and `Gear_ahrim-staff_01_gear_wood` shipped; monsters first differ at node 41, `goblin_belt` against `dark_ranger_arrow_fletch_0`). So the buffer views sit in a different order, the per-figure byte string that compare Brotli-compresses is concatenated in a different order, and its compressed size moves by up to 1.7%. The raw-byte change of the file is the JSON chunk (different order, same content).
- **guard**: the three meshes design 3.2 found. POSITION differs by at most 1.2e-7, NORMAL by at most 0.000222. Everything else identical.

## Determinism

- Second BLEND(hero): the whole file is byte-identical to the first run (`cmp` silent), so the binary chunk is too.
- Extra check, not asked by the plan: a second BLEND(monsters) into the session scratchpad is byte-identical to the first run. The order difference against shipped is the exporter version, not run-to-run noise.

## Hash lists

Before and after are equal (`diff` of the two lists prints nothing):

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
| zero Drift apart from generator and the three guard meshes (within 0.00022) | **not met**: gear, monsters and world drift in file and figure byte sizes from export order; guard meshes within 0.000222 |
| the two hash lists are equal | met |
| UNTOUCHED | met |
| second BLEND(hero) byte-identical binary chunk | met (whole file identical) |

## What closes it (outside P5's file list)

The per-figure `brotliBytes` ceilings in `tests/fixtures/model-contract/monsters.json` and `guard.json` were set by P4 at the shipped files' exact values, with no room for a rebuild on this machine's Blender. Either of these closes it, and both belong to a P4 follow-up, not to this record:

1. give the per-figure Brotli ceilings the same 1% headroom the file totals have (the largest overshoot is 1.7%, `Monster_goblin`, so 2% would be needed for that one), or
2. make the figure byte measure independent of export order (for example, concatenate the figure's buffer views in mesh-name order before compressing).

Option 2 also removes the order-driven Drift lines. The first slice that promotes `monsters.glb` or `gear.glb` built here also re-orders the shipped file. Whether anything in the engine depends on node order was not checked here; the verify of that promotion must check it.
