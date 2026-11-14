# Asset pipeline study, measured with the installed Blender 5.0.1

Date: 2026-11-13. Worktree `osrs-like-wt/E`, branch `wf/E`, base `b2e70e1`. Everything below was measured or read in this worktree. Scripts under "Appendix" are the exact ones run; they lived in a `mktemp -d` directory outside the repository (called `$T` below), with the shipped GLBs in `$T/shipped/` (from `git show HEAD:public/models/<f>.glb`) and fresh builds in `$T/built/`.

Environment: `/usr/bin/blender` = Blender 5.0.1 (Python 3.14.7), exporter "Khronos glTF Blender I/O v5.0.21". The shipped GLBs say `v5.2.41`. Node v22.22.0, three 0.169.0, @gltf-transform core/extensions/functions 4.5.1, meshoptimizer 0.18.1. Every Blender and Node command ran through `scripts/capped.sh` (3 GB memory cap, allowlisted environment), one at a time.

## 1. Reproducibility

Command per mode (`run.sh` in the appendix wraps it with timing, copies the output GLB to `$T/built/`, then runs `git checkout -- public blender`):

```
scripts/capped.sh blender --background --python scripts/blender/build_<mode>.py      # hero gear monsters world
scripts/capped.sh blender --background --python scripts/blender/export_guard.py      # guard
```

`npm run blender:<mode>` goes through `scripts/run-blender.mjs`, which only spawns `blender --background --python <script>` (it falls back to `blender` on PATH when its Windows candidates and `BLENDER_PATH` are absent), so the direct call is equivalent. `blender:export` (`export_from_blend.py`) re-exports `blender/hero.blend` to `hero.glb`; it was not run.

Wall times, from two clean sequential passes (first pass, then the pass used for the comparison below):

| mode | exit | wall pass 1 | wall pass 2 | error text |
|---|---|---|---|---|
| hero | 0 | 23.0 s | 19.1 s | none |
| gear | 0 | 33.2 s | 20.2 s | traceback, see below |
| monsters | 0 | 37.9 s | 29.5 s | traceback, see below |
| world | 0 | 34.2 s | 33.4 s | traceback, see below |
| guard | 0 | 2.2 s | 3.6 s | none |

(An earlier hero and gear run overlapped in time by mistake; those timings were discarded and both were re-run alone.)

Exact error text for gear, monsters and world (same shape, only the file name changes; world shown):

```
image            | ERROR Couldn't create directory for file /c/Users/User/.gemini/antigravity-cli/brain/28c9539a-1323-4489-8927-620e19a4a583/scratch/world_render.png: Permission denied
RuntimeError: Error: Render error (Permission denied) cannot save: '/c/Users/User/.gemini/antigravity-cli/brain/28c9539a-1323-4489-8927-620e19a4a583/scratch/world_render.png'
```

Cause (read): `build_world.py:2291` (and the same line in gear and monsters) hardcodes `render_path = r"C:\Users\User\.gemini\...\world_render.png"`; it can be overridden with `-- --render <path>` (lines 2292-2297). The failure comes after `bpy.ops.export_scene.gltf` (line 2313) and before `bpy.ops.wm.save_as_mainfile` (line 2323). Result: the GLB is written, the `.blend` is not saved, and Blender still exits 0. An exit code of 0 therefore does not mean the build finished. Other log noise, not fatal: `MESA: error: ZINK: failed to choose pdev`, `EGL Error (0x3009): EGL_BAD_MATCH` (headless GL), and at startup `ERROR Draco mesh compression is not available because library could not be found at /usr/lib/blender/scripts/addons_core/io_scene_gltf2/libextern_draco.so` (see section 3d). I did not try the render with an overridden path, so I did not measure whether the render itself works headless. Hero writes both `hero.glb` and `hero.blend` (modified, then restored).

Comparison with the shipped files. Command: `node $T/compare.mjs shipped/<f>.glb built/<f>.glb` (nodes/meshes/materials/animations from the GLB JSON chunk, names diffed as sets), plus `node $T/geo.mjs $T` (per mesh name, POSITION accessor min/max and vertex/index counts) and `$T/glbinfo.mjs` for the BIN chunk.

| file | bytes shipped | bytes built | nodes | meshes | materials | animations | names only on one side | BIN identical |
|---|---|---|---|---|---|---|---|---|
| hero | 216,844 | 216,844 | 29 / 29 | 18 / 18 | 18 / 18 | 10 / 10 | none (nodes, animations) | yes |
| gear | 2,331,560 | 2,331,672 | 575 / 575 | 506 / 506 | 8 / 8 | 0 / 0 | none | no |
| monsters | 4,879,168 | 4,879,064 | 459 / 459 | 399 / 399 | 35 / 35 | 0 / 0 | none | no |
| world | 2,776,656 | 2,776,568 | 462 / 462 | 433 / 433 | 15 / 15 | 0 / 0 | none | no |
| guard | 1,705,360 | 1,705,360 | 28 / 28 | 27 / 27 | 2 / 2 | 0 / 0 | none | no |

Counts are shipped / built. Findings:
- All five modes build with Blender 5.0.1 and match the shipped files in node, mesh, material and animation counts and names. Hero is byte-identical in the BIN chunk and in total size; the file as a whole differs only in the JSON chunk (`generator` string `v5.2.41` vs `v5.0.21`, at byte 72).
- For gear, monsters, world and guard the BIN chunk has the same length (gear, monsters, world differ by 112, -104, -88 bytes in the JSON chunk) but different bytes. By mesh name the POSITION bounds match in every mesh (max delta 1.19e-7 on guard, 0 elsewhere) and vertex and index counts match in every mesh, so the geometry is the same; the accessor/mesh order in the BIN chunk differs.
- Not compared: textures (none embedded), material parameter values, normals and UV values, animation sample values for hero beyond the identical BIN.
- Source `.blend` inputs under `blender/examples/` are tracked in git and were present, so the BlendSwap imports (`get_blend_object`) worked. `blender/*.blend` outputs for gear, monsters and world are not reproduced here (the save never runs, see above). Every tracked file was restored afterwards; the worktree is clean except package.json and package-lock.json.

## 2. Size anatomy of the shipped GLBs

Command: `node $T/anatomy.mjs $T/shipped/*.glb`. Bytes are accessor payload (count x components x component size) classified by use; an accessor used twice is counted once. Percentages are of the BIN chunk. JSON chunk = file - BIN - 28 bytes of GLB headers.

| file | file | BIN | JSON | POSITION | NORMAL | TEXCOORD | indices | anim values | anim times |
|---|---|---|---|---|---|---|---|---|---|
| hero | 216,844 | 176,192 | 40,624 | 40,608 | 40,608 | 27,072 | 31,824 | 35,184 | 896 |
| gear | 2,331,560 | 1,934,276 | 397,256 | 699,144 | 699,144 | 466,096 | 69,888 | 0 | 0 |
| monsters | 4,879,168 | 4,564,352 | 314,788 | 1,598,484 | 1,598,484 | 1,065,656 | 301,728 | 0 | 0 |
| world | 2,776,656 | 2,443,660 | 332,968 | 879,900 | 879,900 | 586,600 | 97,260 | 0 | 0 |
| guard | 1,705,360 | 1,682,420 | 22,912 | 510,312 | 510,312 | 340,208 | 321,588 | 0 | 0 |
| total | 11,909,588 | 10,800,900 | 1,108,548 | 3,728,448 | 3,728,448 | 2,485,632 | 822,288 | 35,184 | 896 |

- Embedded images: 0 bytes in every file; `images` and `textures` arrays are empty. No skin inverse-bind-matrix accessor exists; the 10 hero clips are 74 sampler outputs (12 VEC3, 62 VEC4) plus 7 shared time accessors, float.
- Accessor component types, identical in all five files: POSITION, NORMAL VEC3 FLOAT (5126); TEXCOORD VEC2 FLOAT (5126); indices SCALAR UNSIGNED_SHORT (5123); hero animation times SCALAR FLOAT, values VEC3/VEC4 FLOAT.
- Compression extensions: none. `extensionsUsed` is `KHR_materials_emissive_strength` (gear, monsters), `KHR_materials_specular` (hero), empty for world and guard; `extensionsRequired` is empty everywhere.
- Vertex data (POSITION, NORMAL, TEXCOORD) is 81 percent (guard) to 96 percent (gear, world) of the BIN chunk in the four static files (monsters 93 percent), 61 percent in hero. Unique POSITION vertices: hero 3,384; gear 58,262; monsters 133,207; world 73,325; guard 42,526.
- Most primitives are not indexed: indexed primitives / total are gear 104/506, monsters 63/401, world 144/433, guard 27/27, hero 18/18 (counted as indices accessors per primitive in `anatomy.mjs` output: 104, 63, 144, 27, 18).
- The JSON chunk is 9.3 percent of the total (gear 17 percent, world 12 percent, monsters 6.5 percent). Neither quantization nor EXT_meshopt_compression shrinks it.

## 3. Compression, on copies outside the repository

Script: `$T/compress.mjs` (appendix), run as `scripts/capped.sh node $T/compress.mjs $T`, one process, five files, every variant re-read after writing to check vertex counts and animation counts. Variants with the `c` prefix run `dedup(), prune(), weld()` first. Per-file bytes and totals; the shipped total is 11,909,588.

Two prune settings were measured, because default `prune()` changes what the game gets (see "Behavior risks" below):
- Keep-all: `prune({keepLeaves:true, keepAttributes:true})`. Nothing the game can look up is removed. Script `compressKA.mjs` (the same file with that one substitution).
- Default `prune()`. Script `compress.mjs`.

| variant | hero | gear | monsters | world | guard | total | vs shipped |
|---|---|---|---|---|---|---|---|
| shipped | 216,844 | 2,331,560 | 4,879,168 | 2,776,656 | 1,705,360 | 11,909,588 | 100.0% |
| read and write, no transform | 212,464 | 2,295,284 | 4,850,944 | 2,742,732 | 1,702,424 | 11,803,848 | 99.1% |
| (a) quantize only | 173,044 | 1,269,320 | 2,334,444 | 1,434,444 | 1,213,396 | 6,424,648 | 53.9% |
| (b) meshopt medium | 133,416 | 1,160,996 | 1,632,348 | 1,057,640 | 701,396 | 4,685,796 | 39.3% |
| (b) meshopt high | 105,348 | 1,088,652 | 1,309,408 | 916,840 | 533,952 | 3,954,200 | 33.2% |
| (c, keep-all) dedup+prune+weld, no compression | 209,812 | 2,443,624 | 4,749,844 | 2,908,228 | 1,702,424 | 12,013,932 | 100.9% |
| (c, keep-all) + quantize | 170,508 | 1,239,140 | 2,310,452 | 1,360,740 | 1,213,396 | 6,294,236 | 52.9% |
| (c, keep-all) + meshopt medium | 130,888 | 1,153,696 | 1,624,336 | 1,057,352 | 701,396 | 4,667,668 | 39.2% |
| (c, keep-all) + meshopt high | 102,820 | 1,081,060 | 1,301,056 | 916,424 | 533,952 | 3,935,312 | 33.0% |
| (c, default prune) dedup+prune+weld, no compression | 172,584 | 1,978,472 | 2,035,248 | 1,671,520 | 1,037,692 | 6,895,516 | 57.9% |
| (c, default prune) + quantize | 149,292 | 974,324 | 1,241,000 | 904,808 | 807,568 | 4,076,992 | 34.2% |
| (c, default prune) + meshopt medium | 107,648 | 835,208 | 883,288 | 728,884 | 405,580 | 2,960,608 | 24.9% |
| (c, default prune) + meshopt high | 81,020 | 762,532 | 744,348 | 663,728 | 293,288 | 2,544,916 | 21.4% |
| (d) Draco, Blender exporter (not gltf-transform) | 108,740 | 933,384 | 1,427,008 | 907,708 | 338,356 | 3,715,196 | 31.2% |

Notes on the numbers:
- `meshopt()` in gltf-transform is `reorder` + `quantize` + `EXT_meshopt_compression`; "high" is the encoder level. Quantize-only output requires `KHR_mesh_quantization`; meshopt output requires both that and `EXT_meshopt_compression`.
- Weld (keep-all) does little: unique vertices after weld hero 3,384, gear 52,348, monsters 122,349, world 72,989, guard 42,526 (before: 3,384, 58,262, 133,207, 73,325, 42,526). Hero and guard are unchanged. The (c) keep-all-without-compression row is larger than the no-transform row for gear and world because weld adds indices to primitives that had none. Dedup merges identical meshes: gear 506 to 462 meshes, monsters 399 to 346 meshes (default prune) or 401 to 348 primitives with UVs (keep-all), world 433 to 431, hero materials 18 to 9; node names are all preserved.
- Default prune is what produces the large drops in the lower block: it removes `TEXCOORD` accessors that no texture uses (every shipped GLB has zero textures) and, with `keepLeaves` off, empty nodes. Measured: with default prune the `World_crate` mesh loads in three with attributes `normal,position` only (no `uv`); with keep-all it loads with `uv` Float32 (`$T/three_check.mjs`). Monsters lose 11 named empty nodes under default prune: `elvarg_dragon_HeadGroup`, `_LeftArmPivot`, `_LeftLegPivot`, `_LWing`, `_RightArmPivot`, `_RightLegPivot`, `_RWing`, `lesser_demon_HeadGroup`, `_LeftArmPivot`, `_LeftLegPivot`, `_RightLegPivot`. `blenderMonsters.ts:166` looks pivots up by name (`findPivot(rig.group, typeKey, 'HeadGroup')`, `'LeftArmPivot'`, and so on), so default prune breaks monsters unless `keepLeaves:true`. The second table block (default prune) with `keepLeaves:true` and UVs dropped gives 2,546,060 total (`compressK.mjs`), 1,144 bytes more than the 2,544,916 shown, which dropped the pivots.
- With keep-all, node count, node names, nodes with `extras` (hero 18, gear 3, monsters 56, world 47, guard 0) and animation names are unchanged in every file (`node $T/names2.mjs $T outKA/c+b_dpw_meshopt_high`). Hero keeps 10 animations.
- Round trip: every variant was read back with the meshopt decoder registered; vertex and animation counts were printed for the no-transform, (c) and (c)+meshopt-high variants and match each other, and `three_check.mjs` parsed them with three 0.169 `GLTFLoader` + `MeshoptDecoder` in Node (world.glb `World_crate`: world bounding box 0.85 x 0.85 x 0.85, same as shipped).

### Behavior risks seen with quantization (read plus one measurement)

`$T/three_check.mjs` loads `World_crate` from the shipped file and from the quantized and meshopt keep-all files with three's `GLTFLoader`: shipped `position` Float32Array, not normalized, `mesh.scale` 1, first vertex (0.322, 0.811, 0.404); compressed `position` Int16Array, normalized true, `mesh.scale` 0.425, first vertex reads (-0.759, -0.908, 0.951). The world bounding box is the same, because the node scale carries the size. The game reads geometry positions directly: `src/engine/textures.ts:262-300` (`assignProjectedUvs`, called through `sealAlbedoUvs` at lines 383-391 for materials with `albedoSpace === 'prop'`) computes UVs from `pos.getX/Y/Z`, and `assignGroundUvs` (368-381) does the same. With quantized positions these values are in normalized units, not metres, so prop texture tiling would change. I did not render this; it is a read-and-measured risk, not a measured visual result. TEXCOORD stays Float32 in these outputs.

### (d) Draco through Blender's own exporter

The export call in every build script is `bpy.ops.export_scene.gltf(filepath=..., export_format="GLB", export_yup=True, ...)` and accepts `export_draco_mesh_compression_enable=True`. On this machine the add-on cannot load the library as packaged: it looks for `/usr/lib/blender/scripts/addons_core/io_scene_gltf2/libextern_draco.so` (`io/com/draco.py` `dll_path()`, line 16 onward), but the installed file is `libextern_draco.cpython-314-x86_64-linux-gnu.so`. Without changes, a build prints the "Draco mesh compression is not available" error at startup (seen in every log). I did not rename or install anything. Instead, temp wrappers `$T/draco_<mode>.py` monkeypatch `io_scene_gltf2.io.com.draco.dll_path` to the real file name and `exec` the unmodified build script with `export_yup=True` replaced by `export_yup=True, export_draco_mesh_compression_enable=True` (appendix). Run as `$T/run.sh draco_<mode> $T/draco_<mode>.py <mode>.glb`, all exit 0 (hero 16.4 s, gear 23.8 s, monsters 35.5 s, world 53.8 s, guard 2.5 s). Log lines `Draco encoder: Encoding mesh ...` appear once per mesh: 18, 506, 399, 433 (hero, gear, monsters, world). Sizes are in the table. Nodes, names, animation names and `extras` counts match the shipped files (`names2.mjs $T draco`); `KHR_draco_mesh_compression` is required; Draco was run with the exporter defaults (no explicit quantization settings) and does not weld, dedup or prune (materials stay 18/8/35/15/2). Same-machine compare: Draco total 3,715,196 versus gltf-transform keep-all meshopt high 3,935,312.

### three.js loader support needed

Installed three: package.json `"three": "^0.169.0"`, `node_modules/three/package.json` version 0.169.0.
- `examples/jsm/libs/meshopt_decoder.module.js` exists (24,850 bytes, decoder inlined, no extra file to serve). `GLTFLoader.js` implements `EXT_MESHOPT_COMPRESSION` (line 506) and throws `setMeshoptDecoder must be called before loading compressed files` (line 1628); `KHR_MESH_QUANTIZATION` is supported (lines 501, 2056).
- `examples/jsm/loaders/DRACOLoader.js` exists. `libs/draco/` holds `draco_decoder.js`, `draco_decoder.wasm`, `draco_wasm_wrapper.js`, `draco_encoder.js` and `libs/draco/gltf/` with the same four files. `GLTFLoader` throws `No DRACOLoader instance provided` (line 1922) if the file needs it. `public/` has only `models`, `textures` and `og-banner.png`: no Draco decoder files are served today.
- Loader sites that would change (describe only, nothing edited): five `new GLTFLoader()` in the engine: `src/engine/blenderHero.ts:135`, `blenderGear.ts:23`, `blenderMonsters.ts:13`, `blenderWorld.ts:13`, and the guard loader in `src/engine/runtime.ts` (about line 2057). One more in the tests: `parseGlb` at `src/__tests__/blender-hero.test.ts:30` (`loader.parse` on `public/models/*.glb`). For meshopt each site gets `loader.setMeshoptDecoder(MeshoptDecoder)` with `import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'`, ideally one shared factory so the five sites stay in step. For Draco each site needs a `DRACOLoader` with `setDecoderPath` pointing at copies of `libs/draco/gltf/` placed under `public/`, passed with `setDRACOLoader`; the test would need the decoder to work in Node, which I did not try. Hero, gear and monsters URLs carry a `?v=` cache-buster, world and guard do not (`/models/world.glb`, `/models/guard.glb`), so a replaced world or guard GLB is served from the browser cache until the name or query changes. `package.json` build is `tsc --noEmit && vite build`; `tsc` must also find types for the import (`@types/three` is present).

## 4. What adding one new world prop takes

Followed example: `World_crate`, the smallest builder (`build_world.py:2143-2148`, 6 lines). It is not in the 23-item list at the top of the script or in the test list; it is one of six BlendSwap props (barrel, crate, box_cabbage, box_apples, bag_grain, bag_closed) at lines 2136-2179. A hand-sculpted prop such as `build_plaza_pillar` (lines 1833-1877) follows the same path but builds geometry with the helpers in section "BMesh Sculpting Helpers" instead of importing.

1. Materials. `create_material_library()` (line 197) returns a dict of semantic materials made by `make_material(name, hex, roughness, metallic, emission_hex, emission_strength)` (line 172). Reuse one (`mats["mat_wood"]`) or add one line. Names matter later: the game picks colours and textures from substrings in `origMat.name`, `blenderWorld.ts:62-132` (`bark`, `wood`, `stone`, `iron`, `foliage` and so on).
2. Builder function in `build_world.py`, signature `build_<id>(mats, gx, gz)`:
   - `root = create_root_empty("crate", gx, gz)` (def line 218) creates the Empty `World_crate`, sets `root["worldAssetId"]` and places it at the showcase grid point through `t2b` (line 118: `(tx, ty, tz) -> (tx, -tz, ty)`).
   - Imported prop: `get_blend_object("blender/examples/medieval_props_6679/Props1.blend", "Crate")` (def line 54, caches the object) then `add_imported_world_parts("crate", root, src_obj, {0: mats["mat_wood"]}, scale=0.85)` (def line 79): it splits the mesh by material index, rescales, drops the origin to y = 0 and calls `finalize_mesh(f"World_crate_{mat.name}", ...)` (def line 230), which creates the child mesh object at location 0, parents it to the root, adds a UV layer if missing and applies smooth shading.
   - Sculpted prop: `add_beveled_box` (412), `add_lofted_tube` (264), `add_torus_ring` (627), `add_crystal_prism` (575), `add_faceted_boulder` (483), all in Three.js coordinates, all ending in `finalize_mesh`.
3. Register in `build_all_world_assets()` (line 2182): one call in the grid, for the crate `build_crate(mats, -6.0, 16.5)` at line 2218. A new prop needs one new call and an unused grid point.
4. Export: nothing to edit. `main()` (2284-2328) clears the scene, calls `build_all_world_assets()`, and `bpy.ops.export_scene.gltf(... export_extras=True, export_apply=False)` (line 2313) writes every object, so `World_crate` and its `World_crate_mat_wood` child land in `public/models/world.glb`. Custom properties set with `obj["noOutline"] = True` (in `finalize_mesh`) become node `extras` (47 nodes in shipped world.glb carry extras).
5. Rebuild: `npm run blender:world` (= `scripts/run-blender.mjs world` = `blender --background --python scripts/blender/build_world.py`). On this machine that exits 0 after writing the GLB but fails the render at line 2322 because of the hardcoded Windows `render_path` at line 2291 (pass `-- --render <writable path>` to avoid that; untested here), so `blender/world.blend` is not saved. The source `.blend` for imported props must be present under `blender/examples/`.
6. Use in the game (`src/engine/runtime.ts`):
   - Decor with no existing procedural mesh: `spawnWorldProp('World_crate', x, z, rotY, scale)` (def line 2113): `getTerrainHeight`, a new `THREE.Group`, then after `loadBlenderWorldTemplate()` it clones `gltf.scene.getObjectByName(assetName)`, sets cast/receive shadow, `sealAlbedoUvs`, `addCartoonOutline(grp, 0.028)`. This path keeps the GLB's own materials: `applyWorldMaterials` is not called. Crate uses are at lines 1726-1727 and 1734; the six props are placed between lines 1723 and 1737.
   - Replacing a procedural mesh in place: `place(builder, x, z, 'World_<id>', overrides)` (line 1547, with `plazaPillar` at 1595 and calls at 1658-1660) calls `upgradeWorldPropWithGltf` (`blenderWorld.ts:261`) which swaps children and runs `applyWorldMaterials` (so names in step 1 decide the final materials).
   - The loader is `loadBlenderWorldTemplate()` (`blenderWorld.ts:8`), a single cached promise of `/models/world.glb`.
7. Test: `src/__tests__/blender-hero.test.ts:160-186` lists the 23 `World_<id>` nodes expected in `world.glb` (the six BlendSwap props are not in it); a new prop is added to that list if it should be guarded.
8. Cost seen in the data: world.glb is 2,776,656 bytes; the six BlendSwap props are 17 nodes of the 462 (6 roots, 11 per-material children); each added prop adds geometry in the same uncompressed Float32 layout described in section 2.

## What this means

For a stage that compresses assets:
- The shipped set is 11,909,588 bytes, with no images and no compression extension. Vertex data (POSITION, NORMAL, TEXCOORD, all Float32) is 9,942,528 bytes, 83 percent of the 11,909,588. Meshopt "high" on keep-all gives 3,935,312 (33.0 percent), Draco through Blender 3,715,196 (31.2 percent), quantize only 6,294,236 to 6,424,648 (about 53 to 54 percent). The 2,544,916 (21.4 percent) result is only valid if UVs are dropped and, for monsters, the empty pivots survive; it is not a safe default.
- Meshopt is the cheaper route for this code base: the decoder ships inside three (24,850 bytes), no extra files, one `setMeshoptDecoder` call at five loader sites plus the test helper; Draco also needs `public/` decoder files and a `DRACOLoader`, and it needs the add-on library workaround on this Blender (or a Blender build where `libextern_draco.so` exists) because the packaged file name does not match what the add-on loads.
- Run compression as a post-export step on the GLB (gltf-transform, keep-all prune) instead of changing the Blender scripts; the scripts already work with 5.0.1 and rebuild identical geometry.
- Before enabling quantization, decide how `assignProjectedUvs` and `assignGroundUvs` (`textures.ts:262-381`) get metre positions, because three exposes quantized positions as normalized Int16 plus a node scale (measured on `World_crate`). Dequantizing at load, or keeping POSITION in Float32 and only quantizing NORMAL/UV and compressing with meshopt, are the two options this study did not measure.
- Keep `keepLeaves:true` (named pivots are looked up at runtime) and `keepAttributes:true` (UVs); check materials after dedup (hero 18 to 9) against `applyWorldMaterials` name matching, which I did not run.
- Add the cache-buster `?v=` to the world and guard URLs when files change.
- The two largest files are monsters (4,879,168) and world (2,776,656); with keep-all meshopt high they are 1,301,056 and 916,424.

For a stage that may add world props:
- One prop is one Python function (about 6 lines for an imported mesh, 40 to 60 for a sculpted one), one call in `build_all_world_assets()`, a rebuild with `npm run blender:world`, and one `spawnWorldProp` or `place` call in `runtime.ts`. Naming rule: Empty `World_<id>`, children `World_<id>_<material>` or any mesh name; material names drive game colours through the substring rules in `blenderWorld.ts:62-132`.
- On this machine the world build writes the GLB but not `blender/world.blend` because of the hardcoded Windows render path; pass `-- --render <path>` or fix the path first. Exit code 0 hides it; check the log or the `.blend` timestamp.
- Every added prop grows world.glb in the uncompressed layout; if compression lands first, the prop script is unchanged and the compression step runs after export.
- Whatever is added should be checked against the 23-item test list and, if compression is in place, against the loader changes above (the test helper builds its own `GLTFLoader`).

## Not measured

- Visual and runtime behavior: nothing was rendered or run in a browser. The effect of quantization on `assignProjectedUvs` is read from code plus the `World_crate` attribute measurement, not seen on screen. Load time and decode time (meshopt, Draco) were not measured; only file size.
- `npm test` (vitest) and `tsc` were not run, neither on the shipped nor on compressed files.
- Draco decode in three/Node and the browser path (`DRACOLoader` worker and wasm) were not tried; Draco was measured only through an in-memory monkeypatch of the add-on's library lookup, not through an unmodified Blender install, because the library file is named differently and I may not change the system install.
- Whether the six `.blend` outputs (`gear`, `monsters`, `world` saves) are reproducible: the scripts fail before saving. `hero.blend` was written but not compared. `blender:export` was not run. The studio render and preview step were not measured (hardcoded Windows path; not retried with an override).
- Texture compression (KTX2 and others): no GLB embeds textures, so there is nothing to measure; textures under `public/textures` were not examined.
- Material parameter values, normals, UVs and hero animation sample values between shipped and rebuilt files were not compared individually; only counts, names, POSITION bounds and, for hero, the whole BIN chunk (identical).
- `gltf-transform` options not varied: `simplify`, `sparse`, `resample`, `join`, `instance`, texture options, `weld` tolerance, meshopt filters, explicit Draco quantization bits.
- Gzip or Brotli on the wire: the Vite server or host transfer encoding was not measured, so the on-the-wire gain of compressing before transfer encoding is unknown.
- Blender 5.2.x, the version the scripts were written for, is not installed; differences against it are limited to the `generator` string and the BIN ordering observed above.

## Appendix: scripts as run

`run.sh` (per build; `T` read from a file holding the temp dir path):

```bash
#!/bin/bash
# usage: run.sh <label> <script> <glb>
cd /home/rdrosa/gitprojects/allan/osrs-like-wt/E; T=$(cat /tmp/E_tmp)
s=$(date +%s%N)
scripts/capped.sh blender --background --python $2 > $T/logs/$1.log 2>&1; rc=$?
e=$(date +%s%N)
echo "$1 rc=$rc wall_ms=$(( (e-s)/1000000 ))" | tee -a $T/logs/summary.txt
cp public/models/$3 $T/built/$3
git status --short
git checkout -- public blender
```

`draco_<mode>.py` (example for guard; the build ones replace `export_guard.py` with `build_<mode>.py`):

```python
import sys, pathlib
import io_scene_gltf2.io.com.draco as d
d.dll_path = lambda: pathlib.Path('/usr/lib/blender/scripts/addons_core/io_scene_gltf2/libextern_draco.cpython-314-x86_64-linux-gnu.so')
src = open('/home/rdrosa/gitprojects/allan/osrs-like-wt/E/scripts/blender/export_guard.py').read()
src = src.replace('export_yup=True', 'export_yup=True, export_draco_mesh_compression_enable=True')
exec(compile(src, 'export_guard_draco', 'exec'), {'__name__':'__main__','__file__':'/home/rdrosa/gitprojects/allan/osrs-like-wt/E/scripts/blender/export_guard.py'})
```

`compress.mjs` (the keep-all runs replace `F.prune()` with `F.prune({keepLeaves:true,keepAttributes:true})` and the output folder name):

```js
import fs from 'node:fs'; import {createRequire} from 'node:module';
const R='/home/rdrosa/gitprojects/allan/osrs-like-wt/E/node_modules/';
const {NodeIO}=await import(R+'@gltf-transform/core/dist/index.js');
const {EXTMeshoptCompression,ALL_EXTENSIONS}=await import(R+'@gltf-transform/extensions/dist/index.js');
const F=await import(R+'@gltf-transform/functions/dist/index.js');
const {MeshoptEncoder,MeshoptDecoder}=createRequire(import.meta.url)(R+'meshoptimizer/index.js');
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const dir=process.argv[2]; const names=['hero','gear','monsters','world','guard'];
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const pre=[F.dedup(),F.prune(),F.weld()];
const variants={
 'baseline_roundtrip':[],
 'c_dedup_prune_weld':pre,
 'a_quantize':[F.quantize()],
 'b_meshopt_medium':[F.meshopt({encoder:MeshoptEncoder,level:'medium'})],
 'b_meshopt_high':[F.meshopt({encoder:MeshoptEncoder,level:'high'})],
 'c+a_dpw_quantize':[...pre,F.quantize()],
 'c+b_dpw_meshopt_medium':[...pre,F.meshopt({encoder:MeshoptEncoder,level:'medium'})],
 'c+b_dpw_meshopt_high':[...pre,F.meshopt({encoder:MeshoptEncoder,level:'high'})],
};
const res={};
for(const [v,ts] of Object.entries(variants)){res[v]={};fs.mkdirSync(`${dir}/out/${v}`,{recursive:true});
 for(const n of names){const doc=await io.read(`${dir}/shipped/${n}.glb`);
  if(ts.length)await doc.transform(...ts);
  const buf=await io.writeBinary(doc); fs.writeFileSync(`${dir}/out/${v}/${n}.glb`,buf);
  const d2=await io.readBinary(buf); const cnt=d=>d.getRoot().listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((q,p)=>q+p.getAttribute('POSITION').getCount(),0),0);
  res[v][n]={bytes:buf.length,verts:cnt(d2),anims:d2.getRoot().listAnimations().length};}}
// then prints one row per variant with per-file bytes, total, and percent of the shipped total
```

`anatomy.mjs` classifies accessors by use (mesh primitive attributes and indices, morph targets, animation sampler input and output, skin inverse bind matrices), counts image bufferView bytes, and prints per-kind bytes, accessor `type/componentType` counts and the extension lists. `glbinfo.mjs` splits a GLB into JSON and BIN chunks (`readUInt32LE` of chunk length and type `0x4e4f534a`). `compare.mjs`, `geo.mjs`, `names2.mjs` and `three_check.mjs` are small readers over the same parser (node, mesh, material and animation counts and name set differences; POSITION min/max per mesh name; node name, extras and UV-primitive counts; three `GLTFLoader.parse` with `MeshoptDecoder` printing the `World_crate` position attribute).

---

## Verification addendum (independent re-measurement, 2026-11-14)

Every size, count and compression number above was re-measured and reproduces exactly. The following statements in the report are corrected here; where this addendum and the text above disagree, the addendum is right.

**Wrong in the report**
- "Most primitives are not indexed" is wrong. Every primitive is indexed (gear 506/506, monsters 401/401, world 433/433). Blender shares index accessors (104, 63 and 144 unique ones). The size increase after `weld` is more likely each primitive getting its own index buffer.
- "TEXCOORD stays Float32" is wrong. With meshopt (high or medium) 426 of 433 `TEXCOORD_0` accessors in world become normalized Uint16. NORMAL becomes Int8 at "high" and Int16 at "medium".
- Consequence the report missed: `assignProjectedUvs` and `offsetAlbedoPhase` in `src/engine/textures.ts` write into the existing `uv` attribute with `setXY`. In three 0.169, writing (1.7, -0.3) into a normalized Uint16 attribute reads back (0.7, 0.7): values outside [0, 1] wrap. Projected and phase-shifted UVs would break on every GLB path that calls `sealAlbedoUvs` (hero, gear, monsters, world, `spawnWorldProp`). A compression stage must keep TEXCOORD as Float32 (quantize with texcoords excluded) or copy `uv` to Float32 at load.

**Overstated or unsupported**
- `assignGroundUvs` is only called on the procedural terrain plane, never on GLB geometry: no risk there.
- Default `prune()` does drop the 11 named empty pivots in monsters.glb, but nothing crashes or changes visibly at run time (every use is null-checked). What breaks is the existing test `src/__tests__/blender-hero.test.ts:156`. `keepLeaves: true` remains the right setting.
- "high" is not an encoder level in gltf-transform: it means 8-bit normals in filter mode; "medium" quantizes every attribute. Choosing "high" is a lighting-quality trade.
- Quantization's node scale survives template cloning (looked-up templates are empty nodes; no mesh node has children). Checked by the verifier, not by the original study.

**Omitted, and relevant to the decision**
- `meshoptimizer` is present only through `@types/three` (0.18.1). A compression stage must declare it as a dev dependency.
- `@gltf-transform/functions` pulls in `sharp` and about 40 native `@img/*` packages (dev only).
- Blender 5.0.1's glTF importer cannot read `EXT_meshopt_compression`. Two scripts under `scripts/blender/` import `public/models/gear.glb`, so compress at build time and keep uncompressed masters.
- Every GLB loader falls back to the procedural model with only a `console.warn`. A loader site missing `setMeshoptDecoder` would silently show the old procedural models; only a test would catch it.
- Minor: the `KHR_mesh_quantization` class in three's GLTFLoader is at line 2062, not 2056.
