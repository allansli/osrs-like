# Stage 7, part 1, model compression: design

> **Status (2026-11-14): shelved by the owner, not approved.** The live site already serves the models with Brotli:
> players download 3.76 MB, not the 11.9 MB on disk (measured per file on the deployment). The proposal saves about
> 1.2 MB per load for a new build step and a decoder. The owner chose not to do it now; Stage 7 keeps only the touch
> controls. Revisit if Stages 5 and 6 add many models. Audit finding 27 stays deferred. This document has not been
> through an independent critique; run one before asking for approval.

Date: 2026-11-14. Branch: `feat/reach`, cut from `main` at `d69c300` plus the study commit `45bb05f`. All line numbers refer to `45bb05f`.

Status: proposal. The owner has not reviewed it. Section 8 lists what the owner must decide. Nothing is agreed yet.

This document covers one part of Stage 7: lighter loading by compressing the five GLB models. Touch controls, the other half of Stage 7, are out of scope.

Inputs read: the asset pipeline study `docs/superpowers/research/2026-11-13-asset-pipeline.md` (called "the study"; its "Verification addendum" is called "the addendum"), the Stage 1 and 2 design and plan, `src/engine/gltf.ts`, the four `src/engine/blender*.ts` loaders, `src/engine/worldBuild.ts` (read only), `src/engine/textures.ts`, `src/engine/materials.ts`, `src/__tests__/blender-hero.test.ts`, `tests/gltf-loader.test.ts`, `tests/run-blender.test.ts`, `tests/credits.test.ts`, `scripts/run-blender.mjs`, `scripts/blender/*.py` (paths only), `CREDITS.md`, `vercel.json`, `package.json`, `.github/workflows/ci.yml`.

Measurements: every number in sections 3 and 5 was measured for this design on 2026-11-14. The tools were `@gltf-transform/core`, `extensions` and `functions` 4.5.1 and `meshoptimizer` 1.3.0, installed in a scratch directory outside the repository. Each file was loaded back with three 0.169 `GLTFLoader` and the meshopt decoder that ships inside three. The live site was measured with `curl`. Nothing in the repository was changed.

---

## 1. Intent and scope

Audit finding 27 says: "About 11.9 MB of uncompressed GLBs (float32 attributes, no meshopt, Draco or quantization) is fetched eagerly at boot". This part fixes the size half of that finding. The game should download fewer model bytes and look the same.

What the measurement changed: Vercel already serves the GLBs with Brotli (`content-encoding: br`, measured on the live site). The player downloads **3,761,862 bytes** of models today, not 11.9 MB. The real gain is on that number, so this design measures every option on the wire.

The "eagerly" half of finding 27 is kept as it is. All five files are used by objects built at boot: monsters at `spawns.ts:72`, world props at `spawns.ts:203` and in `worldBuild.ts`, the hero and gear at `playerMesh.ts:54` and `:66`, the guard at `worldBuild.ts:563`. Loading any of them later would mean editing Stage 2 files (section 7) and splitting `monsters.glb` in Blender. The `#27` row in section 4 states this.

| Finding | In this part? | Why |
|---|---|---|
| 27 (11.9 MB of GLBs) | **In** (size). Out (eager loading). | Size is this part's subject. Eager loading: see above. |
| 29 (texture cache keyed by repeat, PNGs decoded and uploaded twice) | **Out** | It wastes decode time and GPU memory, not download bytes: the second `TextureLoader` request for the same URL is most likely answered from the browser's cache (not measured). The fix is in `src/engine/textures.ts` (share one `Source` per URL and clone it per repeat) and is proved in a different way (GPU texture count, not bytes). It is a small standalone task for another Stage 7 part or for Stage 5, which already edits `textures.ts` (finding 23). Decision D6. |
| 3 and 39 (Python build scripts: hardcoded render path, swallowed `.blend` load failures) | **Out** | This part does not regenerate any master, and it does not edit `scripts/blender/`. They stay with the asset pipeline part of Stage 7. |

---

## 2. Constraints

| # | Constraint | Consequence |
|---|---|---|
| K1 | TEXCOORD must stay Float32. The addendum (lines 241-242) found that meshopt "high" or "medium" turns 426 of 433 world `TEXCOORD_0` accessors into normalized Uint16. `assignProjectedUvs` (`textures.ts:256-313`), `stitchUvWraps` (318-346) and `offsetAlbedoPhase` (349-364) write UVs with `setXY`, and three wraps values outside [0, 1] in a normalized attribute. Note on evidence: the study rendered nothing (its "Not measured", line 160). The break was predicted from the code plus one attribute read-back. It was never seen on screen. It is still a hard constraint, because the code path is certain. | UVs are not quantized. A test checks that every `uv` attribute is a non-interleaved `Float32Array`, with values equal to the master. |
| K2 | POSITION must stay Float32. This follows from the code, not from the brief. `assignProjectedUvs` and `stitchUvWraps` read `position` as metres. Quantized positions arrive as normalized Int16 with the scale moved onto the mesh node (study line 109: `mesh.scale` 0.425 on `World_crate`), so the projected tiling and the wrap-stitch limit (`metersPerTile * 0.65`) would be computed in the wrong units. The outline is not a reason: its shader offsets in view space after `modelViewMatrix` (`materials.ts:42-50`), so a node scale does not change its thickness. Only its bounding-sphere margin (`materials.ts:103`) is in object space. | Positions are not quantized. Mesh node transforms stay identical to the master (tested). |
| K3 | The faceted look, node names, pivots, scales, animations, `extras` and the material names the engine looks up must not change. | Only normals change (8-bit). Everything else is bit-exact, which is tested (section 6.4). The look is checked by eye. |
| K4 | Uncompressed masters stay in the repository, and the Blender scripts keep producing them. | Masters stay at `public/models/<name>.glb`. No Blender script changes. |
| K5 | If meshopt is used, `meshoptimizer` is a declared dependency, and a test proves that the decoder is wired into the loader. | `meshoptimizer` becomes an exact-pinned devDependency (the encoder). The runtime decoder is the copy inside three. Test M-2 in section 6.4. |
| K6 | Existing saves are untouched. | No file under `src/state/` changes. |
| K7 | Files that Stage 2 is editing are not touched. | Section 7 lists the one exception, the guard URL. |
| K8 | Smallest solution, fewest new dependencies, no new abstraction without need. | One script, one exported loader factory, four URL edits. No runtime dependency is added. |
| K9 | Vitest runs in the `node` environment. | Every automated proof works without a DOM. Only the look and the decode time need a browser. |

---

## 3. Measured baseline and target

"Live wire" is the byte count `curl -H 'Accept-Encoding: br'` downloaded from `https://gielinor-hero.vercel.app/models/<name>.glb` on 2026-11-14. The decoded bodies hash the same as the repository files (sha256 prefixes: hero `694f652b8471`, gear `92e8eb785b0b`, monsters `a4a4d00b3553`, world `0337e5bf869a`, guard `85fb16a37161`).

The live server's Brotli level is unknown. Brotli quality 3 from Node's `zlib` matches it: hero 137,913 bytes, the same as live. The master total is 3,736,447 at quality 3 against 3,761,862 live, within 0.7%. Every "wire" figure below for a file that is not deployed yet is this **q3 estimate**. The final proof is a `curl` of the preview deployment (plan task V-2).

| File | Master raw | Live wire (br) | Target raw | Target wire (q3 estimate) | Wire change |
|---|---|---|---|---|---|
| hero | 216,844 | 137,913 | 151,372 | 92,144 | -33% |
| gear | 2,331,560 | 674,580 | 1,323,340 | 496,220 | -26% |
| monsters | 4,879,168 | 1,279,641 | 1,597,724 | 786,871 | -39% |
| world | 2,776,656 | 495,345 | 1,145,072 | 371,535 | -25% |
| guard | 1,705,360 | 1,174,383 | 964,108 | 807,041 | -31% |
| **total** | **11,909,588** | **3,761,862** | **5,181,616** (43.5%) | **2,553,811** | **-32%** |

The target column is the chosen setting from section 5, as measured. Budgets for the automated test, with a margin for small model edits: raw total at most **5,300,000** bytes, q3 total at most **2,650,000** bytes.

Side effect, read from three: the decoded normal arrays become `Int8Array` (3 bytes per vertex instead of 12). The normal data uploaded to the GPU falls from 3,728,448 bytes (the study's anatomy table) to about a quarter of that. Positions and UVs are unchanged.

---

## 4. Goals and proofs

| # | Goal | Proof |
|---|---|---|
| G1 | Model bytes on the wire fall from 3,761,862 to about 2.55 MB (at least 25% less). | Automated: `tests/model-compression.test.ts` "size budget" (raw at most 5,300,000; q3 at most 2,650,000). Final: `curl` of the preview deployment (V-2) records the real total of the five compressed files, which must be at most 2,800,000. In the running game G1 is met only after C7 (section 7). Until then the guard master still loads: about 2.92 MB, -22%. |
| G2 | The game loads the compressed files, and the decoder is wired into the one loader. | Automated: M-2. All five compressed files parse through `createGltfLoader()` from `src/engine/gltf.ts`. A bare `new GLTFLoader()` rejects them with `setMeshoptDecoder must be called`, so the passing case is not vacuous. M-6 checks that the four loader URLs point at the compressed files. |
| G3 | Same models: node names in order, node transforms, `extras`, material names and parameters, animation tracks, positions, UVs and triangles. | Automated: M-3, which compares each compressed file with its master, parsed by three. Everything is exact except normals, which must agree within 0.01 (measured worst case 0.00675, under 0.4 degrees). |
| G4 | Same look, the faceted painted style included. | Screenshot comparison per model, before and after, at fixed poses (H-1, then [HUMAN] H-2). Only looking can judge 8-bit normals. |
| G5 | The compressed files always match the masters. | Automated: M-5 runs `node scripts/compress-models.mjs --check`, which re-encodes every master in memory and compares the bytes with the committed file. A master rebuilt without recompressing fails the suite. |
| G6 | Masters, Blender scripts and saves are untouched. | Plan V-1 step 5: a three-dot `git diff main...HEAD` over the five masters, `scripts/blender`, `scripts/run-blender.mjs`, `src/state`, `src/data`, `src/__tests__` and the existing test files must be empty. The frozen `blender-hero.test.ts` still parses the masters and stays green. |
| G7 | The files are valid glTF. | Automated: M-4. `extensionsRequired` lists `EXT_meshopt_compression` and `KHR_mesh_quantization`. No POSITION or TEXCOORD accessor has a component type other than FLOAT (5126). |

---

## 5. Approach

### 5.1 What was measured

Each variant was run on all five masters. "Wire" is the Brotli q3 estimate. "Exact" means positions, UVs, triangles, node transforms, `extras`, material names and animations compared equal in three.

| Variant | Raw total | Wire total | vs live 3,761,862 | Exact (except normals) | Runtime decoder |
|---|---|---|---|---|---|
| Masters (today) | 11,909,588 | 3,736,447 | 0% | n/a | none |
| Float normals + meshopt | 8,367,108 | 3,620,511 | -4% | yes | meshopt |
| 10-bit normals, no meshopt | 8,543,816 | 3,396,649 | -10% | yes | none |
| 8-bit normals, no meshopt (`KHR_mesh_quantization` only) | 7,567,724 | 3,129,830 | -17% | yes, but position and UV come out interleaved | none |
| 10-bit normals + meshopt | 5,766,476 | 2,965,568 | -21% | yes | meshopt |
| **8-bit normals + meshopt (chosen)** | **5,181,616** | **2,553,811** | **-32%** | **yes**, non-interleaved Float32 position and UV | meshopt |
| Study "meshopt high" (positions and UVs quantized; breaks K1, K2) | 3,954,200 | about 1.83 MB (gzip-9 1,818,530) | about -51% | no | meshopt |

On a separate grid with gzip-9 as the wire measure, `reorder()` made the meshopt variants larger (8-bit with reorder 3,077,518 against 2,521,272 without), so it is not used. The study's "meshopt high" total of 3,954,200 was reproduced to the byte.

Almost all of the wire gain comes from quantizing the normals. Meshopt on float data barely beats Brotli (-4%). Meshopt adds about 0.58 MB of wire saving over plain 8-bit normals (3,129,830 against 2,553,811).

### 5.2 Chosen: 8-bit normals, meshopt, everything else lossless

The tool is gltf-transform 4.5.1 with `meshoptimizer` 1.3.0 as the encoder. It is a post-export step on the master GLB. These are the exact settings:

```js
await doc.transform(quantize({ pattern: /^NORMAL$/, quantizeNormal: 8 }));
doc.createExtension(KHRMeshQuantization).setRequired(true);
doc.createExtension(EXTMeshoptCompression).setRequired(true)
   .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
```

Why each setting:

- `pattern: /^NORMAL$/` quantizes only normals. POSITION and TEXCOORD keep Float32 (K1, K2). Joints and weights do not exist (no skins).
- The explicit `KHRMeshQuantization` line is needed because of a defect in gltf-transform 4.5.1: `quantize()` decides whether to add the extension through `isQuantizedPrimitive`, which checks the POSITION accessor for every semantic (`functions/src/quantize.ts:570-575`). With POSITION left as float, Int8 normals are written without the required extension, which makes the file invalid glTF. three loads it anyway, but a validator or another tool would not. M-4 tests the fix.
- `EncoderMethod.QUANTIZE` applies no meshopt filters. With `FILTER`, gltf-transform would put a lossy exponential filter on the hero's animation translation and scale and a 16-bit quaternion filter on rotations (`extensions/src/ext-meshopt-compression/encoder.ts:189-191`). With `QUANTIZE`, the meshopt stage is lossless. Measured: the hero animations come out exact.
- No `dedup`, `prune`, `weld`, `reorder`, `simplify` or `instance`. Each one changes structure: the study lists node and material merges and pivots lost under default prune, and reorder made the files larger. Together they gained under 1% (study, section 3).
- `quantize()` runs its own cleanup with `keepLeaves`, `keepAttributes` and `keepIndices` set (`quantize.ts` cleanup block). It removes only the index and attribute accessors it replaced. Measured: node count, names and transforms are unchanged.

Determinism: two separate runs of exactly these settings on this machine produced byte-identical files (sha256 prefixes hero `f1d697d674e4`, gear `3fe63271a048`, monsters `f1ef1996ad4d`, world `8161842357a1`, guard `63f6f44e25cb`). This was shown on one machine only. CI runs on `ubuntu-latest` with Node 22, the same as here, and the encoder is WebAssembly. Encoding all five files takes about 0.5 s.

Decoder compatibility: the encoder is `meshoptimizer` 1.3.0. The decoder inside three 0.169 is dated 2016-2022 and matches `meshoptimizer` 0.18 (`@types/three` pins `~0.18.1`). All five files decoded correctly with it. M-2 re-proves this on every run, so a future encoder bump that emits a newer bitstream fails the suite before it ships.

### 5.3 Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Do nothing, rely on Vercel's Brotli | That is today's 3.76 MB. Finding 27 stays open. |
| Meshopt without quantization | -4% on the wire for a new decoder path. Not worth it. |
| 8-bit normals without meshopt (`KHR_mesh_quantization` only) | It needs no runtime decoder and no `meshoptimizer` dependency, and gives -17%. It also turns position and UV into interleaved attributes, so `setXY` writes go into a shared buffer. That is likely harmless but a new shape for `textures.ts`. It is the fallback if the owner rejects meshopt (D1). |
| 10-bit normals + meshopt | -21% against -32%. The precision gain is invisible on flat-shaded, low-poly geometry, and the screenshot check (G4) will show whether 8-bit is visible. 10-bit is the fallback if H-2 finds a visible change (D2). |
| Quantized positions and UVs (study "high", about -51%) | Breaks K1 and K2: projected UVs and UV wrap stitching read object-space metres. Making them work means changes in `textures.ts` that only a visual pass can judge. Possible later, together with finding 23 in Stage 5 (D3). |
| Draco (Blender exporter, 3,715,196 raw) | Its raw size is smaller than the chosen variant's (3,715,196 against 5,181,616). Its wire size was not measured. It is rejected for cost and loss, not size:<br>- It needs decoder files served from `public/`, a `DRACOLoader` with a worker and WASM, and a Blender add-on workaround on this machine (study 3d).<br>- It changes every Blender export call, so the masters would no longer be uncompressed (K4) unless the scripts export twice.<br>- `DRACOLoader` hands three Float32 positions in metres, so K2's units hold, but positions and UVs are lossy at the exporter's quantization defaults. Positions and UVs would no longer be bit-exact (G3). |
| gltfpack | Not installed. It quantizes positions and UVs by default, so many flags would be needed to undo that. gltf-transform covers the need from npm. |
| Mesh simplification of the guard (42,526 vertices for two guards) | It changes geometry, so it is outside "compression". It is a content decision for the visual pass. |
| Generate compressed files at build time (gitignored) | Tests in CI run before `npm run build`, so tests and the dev server would also need a pre-step. Vercel would run the encoder on every deploy. Committed files plus a freshness test are simpler (D4). |
| Remap `/models/x.glb` to `/models/x.meshopt.glb` inside `gltf.ts` | It would avoid the Stage 2 file, but a URL that silently loads a different file is a trap. Rejected for the explicit one-line edit (section 7). |
| Replace the masters in place and move the masters elsewhere | The frozen `blender-hero.test.ts` parses `public/models/*.glb` with a bare `GLTFLoader`, and Blender 5.0.1 cannot import `EXT_meshopt_compression` (addendum line 253). `check_local_gear_bounds.py` and `inspect_all_gear_glb.py` read `public/models/gear.glb`. Moving the masters breaks all three. |

---

## 6. Design

### 6.1 Files

- Masters: unchanged at `public/models/{hero,gear,monsters,world,guard}.glb`. Blender scripts keep writing them there.
- Compressed: new committed files `public/models/<name>.meshopt.glb`, written only by `scripts/compress-models.mjs`.
- Deploy: Vite copies all of `public/` to `dist/`, so the masters are still deployed but no code fetches them. They are already public today, so this exposes nothing new. It adds 11.9 MB to the deployment, not to any download (D5).

### 6.2 The compression script

`scripts/compress-models.mjs`, plain Node ESM like `run-blender.mjs`:

- A fixed list `['hero', 'gear', 'monsters', 'world', 'guard']`. No path comes from arguments or the environment.
- For each name: read `public/models/<name>.glb`. Fail with a named error if the file is missing, does not start with the `glTF` magic, or is larger than 32 MiB. Apply the section 5.2 transform. Write `public/models/<name>.meshopt.glb`.
- `--check`: encode in memory and compare with the committed file byte for byte. Write nothing. Exit 1 and name every missing or stale file. Exit 0 when all match.
- Any thrown error exits 2 with a message that names the file and step. The gltf-transform logger is set to WARN, so the normal output is one line per file: name, master bytes, compressed bytes.
- `package.json` gets `"models:compress": "node scripts/compress-models.mjs"`.

New devDependencies, pinned exactly because the freshness check depends on byte-identical output: `@gltf-transform/core` 4.5.1, `@gltf-transform/extensions` 4.5.1, `@gltf-transform/functions` 4.5.1, `meshoptimizer` 1.3.0. `functions` is used only for `quantize()`. It pulls in `sharp` and its native `@img/*` builds: 26 packages and 56 MB on linux-x64, measured. If the owner has added these packages as runtime `dependencies` on another branch, the merge keeps them only as exact-pinned devDependencies, because none of them runs in the browser.

### 6.3 What changes in the loader

`src/engine/gltf.ts`, the only `new GLTFLoader()` in `src` since finding 28:

```ts
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export function createGltfLoader(): GLTFLoader {
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
}

function defaultGltfLoad(url: string): Promise<GLTF> {
  return createGltfLoader().loadAsync(url);
}
```

`loadGltfOnce` is unchanged. The decoder is three's own copy, 24,850 bytes with the WASM inlined, so it adds no runtime dependency and no file to serve. No workers are used. A decoder-equipped loader still reads uncompressed files, so a loader whose URL has not been switched yet keeps working.

Default URLs (only the default parameter value changes; names and signatures stay):

| Loader | Today | After |
|---|---|---|
| `loadBlenderHeroTemplate` (`blenderHero.ts:129`) | `/models/hero.glb?v=kai4503_v5` | `/models/hero.meshopt.glb` |
| `loadBlenderGearTemplate` (`blenderGear.ts:18`) | `/models/gear.glb?v=headgear_v8` | `/models/gear.meshopt.glb` |
| `loadBlenderMonstersTemplate` (`blenderMonsters.ts:7`) | `/models/monsters.glb?v=face_align_v2` | `/models/monsters.meshopt.glb` |
| `loadBlenderWorldTemplate` (`blenderWorld.ts:7`) | `/models/world.glb` | `/models/world.meshopt.glb` |
| `loadBlenderGuardTemplate` (`worldBuild.ts:534`, Stage 2 file) | `/models/guard.glb` | `/models/guard.meshopt.glb`, after Stage 2 merges (section 7) |

The `?v=` keys are dropped. Vercel serves `/models/*` with `cache-control: public, max-age=0, must-revalidate` and an ETag (measured), so browsers revalidate on every load and a query key adds nothing. The new file names also make a fresh URL once (D7).

### 6.4 Tests (all new; no existing test file is edited)

`tests/model-compression.test.ts`:

- **M-1 files exist.** For each name, `public/models/<name>.meshopt.glb` exists.
- **M-2 decoder wired.** Each compressed file parses through `createGltfLoader().parse(...)`. The same bytes through a bare `new GLTFLoader()` reject with a message matching `/setMeshoptDecoder/`. Measured on the candidate hero file: "THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files".
- **M-3 same models.** Each master is parsed with a bare `GLTFLoader` and each compressed file with `createGltfLoader()`, then both scenes are traversed in order:
  - same node count and the same name at every index;
  - `position`, `quaternion` and `scale` equal;
  - `userData` equal as JSON;
  - for meshes: the same material name; `position` and `uv` are non-interleaved `BufferAttribute`s backed by `Float32Array`, with every component equal to the master; triangles equal up to rotation, because the meshopt index codec may rotate a triangle's vertices while keeping its winding (measured); `normal` is normalized `Int8Array`, and every normal is within 0.01 of the master;
  - `gltf.animations`: the same names, track names, times and values, exactly.
- **M-4 valid glTF.** From the GLB JSON chunk: `extensionsRequired` contains `EXT_meshopt_compression` and `KHR_mesh_quantization`. Every accessor used as POSITION or TEXCOORD_0 has `componentType` 5126.
- **M-5 fresh.** `spawnSync(process.execPath, ['scripts/compress-models.mjs', '--check'])` exits 0. The pattern is copied from `tests/run-blender.test.ts`.
- **M-6 URLs.** The text of `blenderHero.ts`, `blenderGear.ts`, `blenderMonsters.ts` and `blenderWorld.ts` contains `'/models/<name>.meshopt.glb'`. The guard assertion is a separate file added after Stage 2 (plan task C7).
- **M-7 size budget.** The raw total is at most 5,300,000 bytes, and the Brotli quality-3 total (Node `zlib`) is at most 2,650,000.

Memory: the test parses ten GLBs (about 17 MB in total). The frozen `blender-hero.test.ts` already parses four masters. Both run under the 3 GB cap.

### 6.5 Workflow when a model changes

1. `npm run blender:<mode>` rebuilds the master, as today.
2. `npm run models:compress` rewrites the compressed files.
3. The suite fails at M-5 if step 2 is forgotten, and at M-3 if a rebuild changed names or structure that the compressed copy does not reflect.

### 6.6 Credits

The compressed files are the same CC-BY and CC0 works, re-encoded. `CREDITS.md` gets one sentence under "Shipped in the game": each `<name>.meshopt.glb` is a compressed copy of `<name>.glb` under the same licence and credit. The "Used in" column is unchanged. `tests/credits.test.ts` is unaffected.

---

## 7. Conflicts with Stage 2

| File | Needed? | What and when |
|---|---|---|
| `src/engine/worldBuild.ts` | Yes, one line | `loadBlenderGuardTemplate` hardcodes `'/models/guard.glb'` at line 534, with no URL parameter. Switching the guard to `guard.meshopt.glb` needs that line changed. Plan: every other task lands without it. The guard keeps loading its master (the decoder-equipped loader reads uncompressed files), which costs 1,174,383 wire bytes instead of 807,041. Task C7 changes the line only after `feat/world-place` has merged to `main` and `feat/reach` has been rebased onto it. Until then, G1's live total includes the uncompressed guard: about 2.92 MB estimated, -22% (D8). |
| Stage 2's JS bundle budget | Yes, a budget and not a file | The decoder module is 24,850 bytes, mostly an inlined WASM string, and it goes into the JS chunk. The Stage 1/2 plan's final check caps the chunk at 951 kB (926.36 + 25) "on `main` after the Stage 2 merge". If this part merges first, that check would count the decoder against Stage 2. V-1 records the chunk size before and after C4 (D9). |
| `README.md` | No | No model sizes or loader details are documented there. |
| `src/engine/spawns.ts`, `worldMesh.ts`, `renderer.ts`, `loop.ts`, `context.ts`, `session.ts`, `input.ts`, `overlay.ts`, `actions.ts`, every `src/state/*` and `src/data/*` file | No | Read only. Their calls to the template loaders do not change. |

No other file on the Stage 2 list is touched.

---

## 8. Owner decisions

| # | Decision | Recommendation |
|---|---|---|
| D1 | Meshopt with 8-bit normals (-32% wire, one decoder line and one dev dependency more), or 8-bit normals alone (-17%, no decoder). | **Meshopt with 8-bit normals.** The extra 0.58 MB matters on phones, and the decoder is already in three. |
| D2 | Normal precision: 8-bit, or 10-bit if 8-bit shows any visible change at H-2. | **8-bit**, with 10-bit as the automatic fallback if H-2 finds a difference (one constant in the script). |
| D3 | Position and UV quantization (about -51%) needs `textures.ts` changes judged by eye. Do it now or later? | **Later**, with finding 23 in Stage 5. It touches the same function. |
| D4 | Compressed files committed (with a freshness test), or generated at build time. | **Committed.** Tests, dev server and Vercel build need no extra step. The output is deterministic. The cost is about 5.2 MB of repository history per model change. |
| D5 | Keep deploying the unused masters (+11.9 MB to the deployment, never downloaded), or exclude them. | **Keep.** Excluding them means moving the masters, which breaks the frozen test and two Blender scripts. |
| D6 | Finding 29 (texture decoded twice) in this part, or later. | **Later**, as its own small task (see section 1). |
| D7 | Drop the `?v=` cache keys on the new URLs. | **Drop.** Vercel already revalidates `/models/*` on every load (measured header). |
| D8 | The guard switch waits for Stage 2's merge (task C7). Accept that the guard stays uncompressed until then. | **Accept.** The alternative is editing a Stage 2 file now. |
| D9 | The decoder adds about 25 kB to the JS chunk. Count it outside Stage 2's 951 kB cap. | **Yes.** Raise that cap by the C4 delta that V-1 records, whichever stage merges first. |

---

## 9. Threat model

### 9.1 What are we working on?

| Flow | Source | Trust | Sink |
|---|---|---|---|
| Compression step | `public/models/*.glb` masters written by our Blender scripts | Ours, reviewed in git | `public/models/*.meshopt.glb`, committed |
| Dev tooling | npm packages `@gltf-transform/*`, `meshoptimizer`, `sharp` and `@img/*` (transitive) | Third party | Developer machines, CI (`npm ci`), Vercel build install |
| Runtime decode | Same-origin `*.meshopt.glb` fetched by the browser | Trusted content. The fetch can fail or be cut short. | three's meshopt decoder (WebAssembly), then the scene |
| Freshness check | The same masters and committed files | Ours | Exit code in the test suite |

Trust boundaries: the npm supply chain (install time on three kinds of machine), and the network fetch of model bytes, where integrity is TLS plus same origin. No player input reaches the new code. The script takes no path from arguments or the environment.

### 9.2 What can go wrong?

| # | Failure |
|---|---|
| T1 | A compromised or typo-squatted dev package runs code at install time on a developer machine, in CI or in the Vercel build. `sharp` brings native binaries. |
| T2 | A dependency bump changes the encoder output: the bitstream becomes something three's 2022 decoder cannot read, or the look changes. |
| T3 | The decoder is not registered (a refactor, or a new loader that bypasses `gltf.ts`). Every GLB load then fails, and each loader falls back to the procedural model with only `console.warn`, which is easy to miss. |
| T4 | A master is rebuilt and its compressed copy is not, so the game ships stale models. |
| T5 | A truncated or corrupt `.meshopt.glb` (bad deploy, cut-off fetch) reaches the decoder. |
| T6 | A future `script-src` Content Security Policy (planned with Stage 5) blocks the decoder's `WebAssembly.instantiate`, and every model silently falls back to procedural. |
| T7 | Quantization changes something the engine reads (positions, UVs, node scale, names), and textures, outlines or pivots break. |
| T8 | The script writes outside `public/models` or overwrites a master. |
| T9 | The script reads a huge or malformed input and runs out of memory under CI. |

### 9.3 What are we going to do about it?

| Risk | Decision |
|---|---|
| T1 | Mitigate: exact versions, `package-lock.json` integrity hashes, `npm ci` in CI, `npm audit --audit-level=high` in V-1. Accept the rest: `sharp` is a transitive dev dependency of a widely used tool and never runs in the game. Transfer: the plain-quantization fallback (D1) or a hand-written normal quantizer could remove `@gltf-transform/functions` later if its weight becomes a problem. |
| T2 | Mitigate: exact pins. M-2 decodes every committed file with three's own decoder on every run. M-5 fails on any change in output, so a bump forces regeneration and a new H-2 look check. |
| T3 | Mitigate: one loader factory (`createGltfLoader`). M-2 proves that it decodes, and that a bare loader cannot. M-6 proves that the URLs point at compressed files. The architecture test already imports `gltf.ts` in node. |
| T4 | Mitigate: M-5 freshness check in the suite and in CI. |
| T5 | Accept: the decoder validates its own stream headers and fails. `loadGltfOnce` resolves `null`, forgets the failure so the next call retries, and the game shows the procedural model (Stage 1 behaviour). No player data is involved. |
| T6 | Mitigate by recording it: section 10 R5 and the plan's handover note tell Stage 5 that a `script-src` policy must include `'wasm-unsafe-eval'`. No CSP `script-src` exists today (`vercel.json` sets only `frame-ancestors`). |
| T7 | Eliminate by design: positions, UVs, transforms, names, `extras`, materials and animations are bit-exact (K1, K2, M-3). Normals are the only lossy change, and they are checked by M-3's tolerance and by eye (H-2). |
| T8 | Eliminate: fixed name list, fixed directory, output name always `<name>.meshopt.glb`. M-5 runs in `--check` mode and writes nothing. |
| T9 | Mitigate: 32 MiB input cap and magic check before parsing. The suite runs under the 3 GB `systemd-run` cap. |

### 9.4 Did we do a good enough job?

The proofs are M-1 to M-7 (automated, every CI run), H-1 and H-2 (look), and V-2 (real wire bytes on the preview deployment). If M-3 cannot be made exact for positions, UVs and animations, the chosen setting is wrong and the work stops at that task. If H-2 sees a difference, D2's fallback applies and M-3's normal tolerance stays the same.

---

## 10. Risks

| # | Risk | Likelihood | Handling |
|---|---|---|---|
| R1 | 8-bit normals visibly change shading on smooth-shaded parts. The faceted look comes from geometry and flat materials, but most materials are not `flatShading` (`materials.ts:114-139`). | Low. Worst error measured is 0.00675, under 0.4 degrees. | H-2. If it shows, switch to 10-bit (D2): 2,965,568 wire bytes, still -21%. |
| R2 | Byte determinism does not hold on CI (different CPU, Node patch version), so M-5 fails in CI only. | Low. The encoder is WASM, and Node and the OS are the same. | If it happens, replace the byte comparison with "decoded equal plus the hash of the master stored in `asset.extras`". That is a small change in the script and M-5 only. |
| R3 | Vercel's real Brotli level on the new files differs from the q3 estimate. | Medium (the estimate is calibrated only on the masters). | V-2 measures the preview deployment. G1's real-world bar is 2.8 MB, looser than the 2.65 MB estimate budget. |
| R4 | Decode time on low-end phones offsets the download gain. | Low (meshopt decodes at hundreds of MB/s) but not measured. | H-3 records load-to-first-model time before and after on the owner's machine with throttled network. |
| R5 | Stage 5 adds `script-src` without `'wasm-unsafe-eval'`. | Medium. | Handover note (plan V-3). The silent fallback is caught in the browser by H-2 and by the console warning. |
| R6 | The repository grows by about 5.2 MB for every regeneration. | Certain. | Accepted (D4). Git LFS was already left as a separate proposal (CALL-12 in the Stage 1 design). |
| R7 | The Stage 2 merge conflicts with this branch in `package.json` or `package-lock.json`. | Low (Stage 2 adds no dependency, C5 of the Stage 1 design). | C7 rebases after Stage 2. Lockfile conflicts are resolved with `npm install` and re-checked by SG. |
| R8 | The `meshoptimizer` 1.x types and the `~0.18.1` copy that `@types/three` pulls in conflict in `tsc`. | Low. npm nests 0.18.1 under `@types/three`, and three's decoder types resolve from there. | TYPES in the standard gate catches it. |

---

## 11. Checks of the study

The study's size and count numbers were re-measured where this design uses them. The meshopt "high" total, 3,954,200, reproduced exactly. These study statements are wrong, stale or not supported:

1. **Stale: loader sites.** The study says "five `new GLTFLoader()` in the engine", including one in `runtime.ts` at about line 2057. Since finding 28 (Stage 1), there is one: `src/engine/gltf.ts:6`. `runtime.ts` no longer contains a loader, and the guard loader is at `worldBuild.ts:534`. Only the test helper `blender-hero.test.ts:30` makes its own.
2. **Wrong for the deployment: browser cache.** The study says a replaced world or guard GLB "is served from the browser cache until the name or query changes". Vercel answers `/models/*` with `cache-control: public, max-age=0, must-revalidate` and an ETag (measured), so browsers revalidate on every load.
3. **Overstated: download weight.** "The shipped set is 11,909,588 bytes" is true on disk. Vercel serves the files with Brotli, though, and the download is 3,761,862 bytes (measured). The study listed transfer encoding as not measured. Finding 27's "11.9 MB fetched" overstates the transfer about 3.2 times.
4. **Not reproduced: "`sharp` and about 40 native `@img/*` packages"** (addendum). On linux-x64, `npm install` of the three gltf-transform packages and `meshoptimizer` added 26 packages in total, 6 of them under `@img/`, 56 MB.
5. **Not observed: "quantized UVs broke the look".** The study rendered nothing. The UV problem is a prediction from the code plus an attribute read-back of a normalized Uint16 `setXY` wrap (addendum lines 241-242). It is kept as constraint K1 because the code path is certain, but no screen showed it.
6. **Likely stale: "exit code 0 hides the failure".** The study ran Blender directly. `scripts/run-blender.mjs` now passes `--python-exit-code 1` (finding 36, Stage 1), so through `npm run blender:gear`, `:monsters` or `:world` the render `RuntimeError` after export probably exits non-zero, even though the GLB is written. Not run. No task here regenerates a master.
7. **Missed by the study: invalid output when only normals are quantized.** gltf-transform 4.5.1 omits `KHR_mesh_quantization` when POSITION stays float (section 5.2). The study quantized positions, so it never hit this.
8. **Unverifiable here:** the Draco figures (Blender add-on monkeypatch, study 3d) were not re-run. Draco is rejected for other reasons.

---

## 12. Not measured

- Decode time and time to first model in a browser (H-3 records it).
- Vercel's Brotli level on the new files (V-2 measures it on the preview deployment).
- The look of 8-bit normals on screen (H-1, H-2).
- Byte determinism on a second machine (M-5 in CI is the first such run).
