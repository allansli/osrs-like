# P5: full rebuild into scratch

Date: 2026-11-14. Branch `feat/models-pass`. Plan task P5. This is the second run (a repair): the first run, at head `256522d` (record in commit `29ee250`), found two compares exiting 2 on per-figure Brotli ceilings. Commit `99b9d01` (a P4 follow-up, `scripts/models-manifest.mjs` and the regenerated manifests) gave per-figure `brotliBytes` ceilings 2% headroom over the shipped values; every other ceiling is unchanged. This run is at head `99b9d01`.

**Verdict: Accept is met except one item.** Five builds and five compares exit 0, Contract and Budget pass everywhere, nothing shipped changed, the hero build is deterministic. **Not met: "zero Drift apart from the generator string and the three guard meshes".** Gear, monsters and world still drift in whole-file `rawBytes` and `brotliBytes` from export order (below). That needs a plan or owner amendment accepting it; this record does not grant it. Nothing was promoted.

## Environment

- Blender: `Blender 5.0.1` (`/usr/bin/blender`, the only install on this machine). Built files carry generator `Khronos glTF Blender I/O v5.0.21`; shipped files carry `Khronos glTF Blender I/O v5.2.41`.
- Every command ran through `scripts/capped.sh` (allowlisted environment, 3 GB cap), one Blender process at a time, `timeout 600`. `scratch/models-build/` was emptied first.

## Commands and results

| Step | Command | Exit | Wall time |
|---|---|---|---|
| hashes before | `sha256sum public/models/*.glb blender/*.blend` | 0 | - |
| BLEND(all) | `scripts/capped.sh timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs all --out scratch/models-build` | 0 | 13 s (hero, gear, monsters, world) |
| BLEND(guard) | same, mode `guard` | 0 | 2 s |
| COMPARE x5 | `node scripts/models-compare.mjs scratch/models-build/<name>.glb public/models/<name>.glb` | 0, 0, 0, 0, 0 | - |
| BLEND(hero), second run | same, mode `hero` | 0 | 3 s |
| hashes after | same `sha256sum` | 0 | - |
| UNTOUCHED | `git status --short public/models blender` | 0, prints nothing | - |

The hero build logs `Unable to pack file` for the Kai textures and for the author's path inside the source `.blend` (design 3.2 and 11). It exits 0 and its binary chunk matches the shipped one.

Built outputs under `scratch/models-build/`: `hero.glb` 216,844 bytes, `gear.glb` 2,331,672, `monsters.glb` 4,879,064, `world.glb` 2,776,568, `guard.glb` 1,705,360, plus the four `.blend` files and `kai/`.

## Compare reports (summaries)

| File | Exit | Contract | Budget | Drift |
|---|---|---|---|---|
| hero | 0 | pass | pass | generator only |
| gear | 0 | pass | pass | generator; rawBytes 2,331,560 -> 2,331,672; brotliBytes 668,121 -> 654,482 |
| monsters | 0 | pass | pass | generator; rawBytes 4,879,168 -> 4,879,064; brotliBytes 1,266,221 -> 1,273,402 |
| guard | 0 | pass | pass | generator; geometry bytes of `Plane.032`, `Circle.038`, `Circle.034`; brotliBytes 1,174,350 -> 1,174,329 (follows from those three meshes) |
| world | 0 | pass | pass | generator; rawBytes 2,776,656 -> 2,776,568; brotliBytes 489,842 -> 493,474 |

Per-figure Brotli, built against the new ceiling (shipped value plus 2%), for the figures the first run failed: `Monster_goblin` 75,463 / 75,652; `Monster_goblin_archer` 63,884 / 65,050; `Monster_hill_giant` 64,922 / 66,204; `Monster_moss_guardian` 58,552 / 59,694; `Monster_scorpion` 84,340 / 85,712; `CastleGuard` 1,174,334 / 1,197,803.

## Why the remaining Drift is export order, not content

Checked in the first run against `scripts/lib/glb.mjs`, matching meshes by name, and unchanged here (same built sizes):

- **hero**: binary chunk byte-identical to the shipped one; JSON differs only in `asset.generator`.
- **gear, monsters, world**: every mesh's attribute and index bytes equal the shipped mesh of the same name (0 differences over 506, 399 and 433 meshes). The node, mesh and material sets are equal; their order differs (Blender 5.0.1's exporter against 5.2.41). The JSON chunk holds the same content in another order, so its length moves (rawBytes), and the binary chunk holds the same views in another order, so the whole file compresses differently (brotliBytes). Compare's per-node and per-mesh Drift checks report nothing for these files.
- **guard**: node, mesh, material and buffer-view order equal to shipped (checked in this repair). The three meshes design 3.2 found differ: POSITION by at most 1.2e-7, NORMAL by at most 0.000222. That is content, which is why order-independent measuring would not have fixed `CastleGuard` and headroom was used instead.
- Builds are deterministic run to run (second hero build below; the first run also rebuilt monsters twice, byte-identical). The order difference is the exporter version.

**Amendment needed to close the open item:** the plan (P5 Accept) or the owner accepts, for builds on Blender 5.0.1 against the 5.2.41-exported shipped files, whole-file `rawBytes` and `brotliBytes` Drift on gear, monsters and world from export order, given equal node, mesh and material sets and zero per-mesh byte differences. The alternative is building on Blender 5.2, which is not installed here.

## Determinism

Second BLEND(hero): `cmp` of the first and second `hero.glb` is silent, so the whole file and its binary chunk are byte-identical.

## Hash lists

Before and after are equal (`diff` of the two lists prints nothing), and equal to the first run's:

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
| five compares exit 0 | met (after `99b9d01`) |
| zero Contract differences | met (all five) |
| zero Drift apart from generator and the three guard meshes (within 0.00022) | **not met**: gear, monsters and world drift in whole-file bytes from export order; needs the amendment above. Guard's Drift is the three meshes (NORMAL within 0.000222) and the file Brotli size that follows from them |
| the two hash lists are equal | met |
| UNTOUCHED | met |
| second BLEND(hero) byte-identical binary chunk | met (whole file identical) |

The first slice that promotes `monsters.glb`, `gear.glb` or `world.glb` built here also re-orders the shipped file. Nobody has checked whether the engine depends on node order. The verify of that promotion must check it.
