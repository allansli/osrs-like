# Visual pass: critique of the design and the plan

Date: 2026-11-14. Branch: `feat/visual-pass`. Critiqued: `docs/superpowers/specs/2026-11-14-visual-pass-design.md` and `docs/superpowers/plans/2026-11-14-visual-pass-plan.md` at commit `cb4ce29`. Source read at that commit (same code as `a8cad85`), three at the installed `0.169.0`, `public/models/world.glb` (JSON chunk parsed), and the Stage 2 branch `feat/world-place`.

Nothing was run: no test, build, dev server or browser. Every claim below comes from reading the code. The fixes marked "fixed" are applied to the two documents in the same commit as this file.

## Verdict

**READY-WITH-FIXES.** The direction is right and ambitious enough for the owner's bar. The central premise holds: the facet shader really throws away three's lights, so a real light model is the biggest win for the least code. But one premise is wrong (the camera limits), one is partly wrong (shadows are visible on 13 props), and several pipeline details would have produced visible defects or untestable budgets: fog applied in two different colour spaces, a whole lit world above the bloom threshold, a carpet that ignores shadows, program-cache collisions in chained shader hooks, frame times quantised by vsync, and no task that builds the capture driver every checkpoint depends on. Two of the owner's explicit requirements were thin: the tier table did not map every feature, and there was no comparison with how established games solve each problem. All of these are fixed in the documents. Seven choices are left to the owner (end of this file).

## Premise table

| # | Premise in the design | Status | Evidence |
|---|---|---|---|
| P1 | `facetMaterial` discards the scene's lights | **Confirmed** | `materials.ts` 158-163 replaces exactly three's line `vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;` (`meshlambert.glsl.js` 108) with `diffuseColor.rgb * mix(...)` from a fixed direction (161). `reflectedLight` is never read after that. Emissive is kept. `albedoMaterial` (`textures.ts` 226-238), `terrainMaterial` (`textures.ts` 445-479), `paint` (`monsterMeshes.ts` 54) and every GLB conversion (`blenderWorld.ts` 62-115, `blenderGear.ts` 63-80, `blenderMonsters.ts` 108-115) go through it. |
| P2a | The shadow pass is rendered every frame | **Confirmed** | `shadowMap.enabled = true` on every tier but performance (`renderer.ts` 31-38, 122); `WebGLShadowMap.autoUpdate = true` (`WebGLShadowMap.js` 66, checked at 75); `sunLight.castShadow` (`renderer.ts` 141); 38 `castShadow`/`receiveShadow = true` sites. |
| P2b | No pixel shows a shadow | **Partly wrong** | `spawnWorldProp` (`worldBuild.ts` 580-603) never calls `applyWorldMaterials`: its 13 props (barrels, crates, produce boxes, sacks; `worldBuild.ts` 204-214) keep the GLB's `MeshStandardMaterial`, set `receiveShadow = true`, and so are lit by the three lights and do show shadows. Every facet surface (nearly everything else) does not. Figures set `receiveShadow = false` (`blenderHero.ts` 203, `blenderGear.ts` 87, `blenderMonsters.ts` 98). |
| P3 | `renderer.info` misses the shadow pass | **Confirmed** | `WebGLRenderer.js` 1216 `shadowMap.render(...)`, then 1222 `if ( this.info.autoReset === true ) this.info.reset();` before the colour pass. `loop.ts` 685 reads `info.render.calls` after `render`. The proposed fix (`autoReset = false`, one manual reset per frame) does count it. |
| P4 | Default shading is smooth, not faceted | **Confirmed** | `materials.ts` 118 `let flat = false`, 139 `cleaned.flatShading = flat`, doc comment 110-114. Only five callers pass `flatShading: true`: `blenderWorld.ts` 66 and 80, `spawns.ts` 140, `worldBuild.ts` 169 and 317. |
| P5 | Time of day changes only the sky and fog | **Confirmed** | `cycleTimeOfDay` (`worldMesh.ts` 70-96) writes three sky uniforms, `fog.color`, `fog.density`, the button label. No light is touched. |
| P6 | Sky, water and grass skip tone mapping, colour space and fog | **Confirmed** | Sky `worldMesh.ts` 52-63 and water 161 write `gl_FragColor` with no `tonemapping_fragment`/`colorspace_fragment`; grass `materials.ts` 200-215 the same, with its own light direction at 176. `ShaderMaterial.fog` defaults to false. Uniform colours set by `setHex` are linear (colour management on by default), so they display darker than authored. |
| P7 | Draw calls: 433 meshes in 29 props, tree 13 to 2, castle 68 to 5 | **Confirmed** for the GLB | Parsed JSON chunk: 433 meshes, 433 primitives, 29 roots; normal tree 13 meshes over 2 materials, oak 18/2, castle 68/5, bridge 41/3, ore rock 9/2, shrine 20/4, magic tree 22/4. `applyWorldMaterials` clones each mesh's geometry (`blenderWorld.ts` 50). The 1509 calls / 226k triangles come from the Stage 1 baseline file and are **not provable by reading**. |
| P8 | The camera cannot exceed 0.42 rad pitch or 9.5 units distance (`sanitizeCam`) | **Wrong** | `sanitizeCam` (`save.ts` 231-238) only clamps a camera read from a save (`session.ts` 76). The live limits are pitch 0.12 to 1.15 rad (`input.ts` 114) and distance 3.6 to 26 (`input.ts` 125). The design built its shadow-range argument (4.2), the pose limits (8.2, V1a) and the horizon reasoning (6.4) on the wrong numbers. |
| P9 | Program cache key is `onBeforeCompile.toString()` plus defines | **Confirmed, with a trap** | `Material.js` 109-113; `WebGLPrograms.js` 360, 410. But `onBeforeCompile` runs per material and `acquireProgram` then returns any program with the same key (`WebGLRenderer.js` 1669-1689). A wrapper chained by `attachAtmosphere` has the same text for every material it wraps, so the inner hook (terrain's eight maps, or the plain facet hook) no longer separates the keys. |
| P10 | The shadow term is inside `directLight.color` when `RE_Direct` runs | **Confirmed** | `lights_fragment_begin.glsl.js` 144-147. Replacing `lights_lambert_pars_fragment` therefore gets shadows for free. |
| P11 | `CSM.setupMaterial` overwrites `onBeforeCompile` | **Confirmed** | `examples/jsm/csm/CSM.js` 253-269. |
| P12 | 38 inline `onclick` attributes, one script tag | **Confirmed** | `grep` of `index.html`: 38 `onclick="`, one `<script`. |
| P13 | Fog in three runs after tone mapping and colour space | (not claimed; found) | `meshlambert.glsl.js` 111-115: `tonemapping_fragment`, `colorspace_fragment`, then `fog_fragment`. The design puts `applyAir` at the fog position in the facet shader but before the colour footer in the custom shaders: two colour spaces for one fog. |

## Findings

Severity: **critical** blocks the stage; **high** produces a visible defect, an untestable gate or misses an owner requirement; **medium** costs rework or a fragile step; **low** is polish. All findings below are fixed in the documents unless marked "owner".

### Critical

None after the fixes. Before them, H1 and H2 together would have made the G5.8 proof pass while the player could still see the world end; that is high, not critical, because it is found at CP-AR at the latest.

### High

**H1. The camera premise is wrong (P8).** Pitch reaches 1.15 rad and distance 26 in play. Effects: the V1a pose test would encode 0.42 and 9.5 and reject valid poses; P10 ("maximum distance") would be taken at 9.5, not 26; the shadow-range argument in 4.2 relied on 9.5. Fix: the design and V1a use the live limits from `input.ts`; P10 is taken at distance 26 and pitch 0.12; 4.2 re-argued (the single fitted map still holds: at pitch 0.12 the far ground is through air, at 1.15 the view footprint is small). Fixed.

**H2. The horizon ring cannot close the view as specified.** The walkable area is a square to plus or minus 118 (`collision.ts` 47), so the camera can stand about 118 times root 2 plus 26, roughly 193 units, from the centre. A ring of radius 150 to 240 around the origin (a) overlaps the terrain's own corners, which reach 184; (b) leaves a 20-unit void between the terrain edge at 130 and the ring at 150 along each side; (c) is up to about 433 units from the camera, beyond `far` 360, so its far side is clipped. The test `HORIZON_RING.outer < CAMERA_FAR` checks the wrong thing. Today's sky dome (radius 290, fixed at the origin, `worldMesh.ts` 40) is also clipped from the corners. Fix: the ring becomes an apron welded to the terrain's square edge (inner boundary = the 130 square, shared edge heights) rising to hills by radius 240; camera `far` becomes 460; the dome follows the camera with radius 440; the test checks that the largest camera-to-apron distance (from the walk bound, the live maximum camera distance and the apron's outer radius) is below `far`, and that the apron's inner edge equals the terrain edge. Fixed.

**H3. Fog runs in two colour spaces (P13).** In the facet shader, `applyAir` replaces `fog_fragment`, which three places after tone mapping and sRGB conversion; in the sky, water, carpet and particle shaders it runs before the colour footer, in linear light. The same air colour would then show two different colours where the sky meets the terrain. Worse, on the composer tiers three renders into a target with tone mapping off and linear output, so the facet shader's fog is in linear there and in sRGB on the direct path: "both paths show the same game" (6.10) is false. Fix: one rule, `applyAir` always runs on linear radiance before `tonemapping_fragment` in every shader (in the facet shader: inserted before `#include <opaque_fragment>`, `fog_fragment` removed), and every `AIR` colour uniform holds linear values. Then the direct path tone maps in the shader and the composer path in `OutputPass`, on the same numbers. `glowMaterial` and other `MeshBasicMaterial` effects keep three's fog and its small difference, accepted. Fixed.

**H4. The whole lit world would bloom.** Without the division by pi, a noon key of 2.0 on an albedo of 0.75 (sRGB, about 0.52 linear) gives about 1.04 before fill and bounce, roughly 1.3 with them. `UnrealBloomPass` thresholds linear, pre-exposure values, so "only emissive colour passes a high threshold" needs the threshold above the brightest lit surface and every emitter above the threshold. FX2's emissive multiplier of 1.6 sits close to lit sand at noon. Fix: `BLOOM.threshold` lives in `look.ts`; a look-data test computes the brightest lit value over all keys (albedo 0.75, full band, fill and bounce) and requires the threshold to exceed it by 15%, and requires every emitter and every FX core colour to exceed the threshold by 20%. FX2 takes its multiplier from that number. Fixed.

**H5. The carpet would ignore shadows.** The carpet was a custom `ShaderMaterial` that shades by `uKeyColor` and `uFill`. Without three's shadow chunks it never receives a shadow, so a tree over a meadow shades the ground between tufts and leaves the tufts bright: the most common grass-shadow defect in stylised games. Fix: the carpet uses `facetMaterial` (round, two bands) with a vertex patch on `begin_vertex` for placement and wind. It then receives the shadow map, the banded light and `applyAir` through the same code as everything else, and it shrinks GR6 (no second lighting model). The water stays a `ShaderMaterial` and does not receive shadows (accepted, written). Fixed.

**H6. Chained shader hooks collide in the program cache (P9).** `attachAtmosphere` wraps `onBeforeCompile`; the wrapper's source text is identical for the terrain and for plain facet materials, so their keys differ only by three's parameters. Any two materials with the same parameters but different inner hooks share whichever program compiled first, with the wrong uniforms: black or wrongly textured surfaces, silently. Fix: every patched material sets `customProgramCacheKey` to a string built from constant tags of its patch chain (for example `facet|cut|terrain|air`); a test asserts that the terrain, a cut facet, a round facet and the carpet return four different keys. Fixed.

**H7. Frame-time budgets were not testable.** The perf HUD's time is the interval between animation frames (`loop.ts` 676-679), which vsync rounds to 16.7 ms on a 60 Hz display: "balanced within 10% of V2" cannot be read when both are at vsync, and a 30 Hz panel or a hidden tab looks like a slow GPU. Budgets were also approved at OV-1, before any measurement. Fix: V1b adds `__DEBUG.look.bench(frames)`, which renders back to back and waits for the GPU with `gl.finish()` once at the end, returning milliseconds per frame free of vsync; every frame-time number in section 10 is a bench number; OV-2 now also confirms or revises the budgets (CALL-V6) and the tier numbers with the measured baseline before LT1 starts. Fixed.

**H8. No task builds the capture driver.** Every checkpoint relies on CAP (seeded `Math.random`, onboarding dismissed, poses, JPEGs), but no dependency provides a browser driver (`package.json` has none) and no task writes the procedure. Also, headless capture runs on a software renderer, where the design starts on the performance tier, so the balanced and high pictures CP-AR asks for could never be taken. Fix: new task V1c writes and proves the procedure with the Playwright tools available to the main session (an init script for the seed, no new dependency), and V1b adds `look.tier(id)`, which sets a tier and turns the governor off for the session. Fixed.

**H9. The tier table did not map every feature (owner requirement 3).** Missing rows: the air (height fog, sun lean, region tint), the banded light, the sky details (stars, discs), the horizon apron, the foot gradient, canvas antialiasing, the outline toggle, the composer's samples, the shadow fade, the governor. The owner was not asked whether to rename the tiers. Fix: the table in design section 10 now has one row per visual feature, with the reason the lowest tier stays cheap; owner decision D1 asks about the names. Fixed (names: owner).

**H10. No comparison with established games and engines (owner requirement 4).** Section 4 compared options but never named the technique the industry uses for each problem. In places the design reinvented a known technique without saying so (its fog is exponential height fog with directional inscattering; its vegetation layout is a hand-made clustering rule where Poisson-disk placement under a density mask is the standard; its foot gradient is fake ambient occlusion). Fix: new design section 4.7, one row per technique choice, naming the established technique, where it is used, and why it fits or does not fit a WebGL browser game; scatter adopts Poisson-disk spacing. Fixed.

### Medium

**M1. `spawnWorldProp` keeps PBR materials (P2b).** Its 13 props would stay smooth `MeshStandardMaterial` in a cut world, with no banding and no `applyAir`, and the merge key (colour, albedo id, shade) does not describe them. Fix: LT5b makes `spawnWorldProp` call `applyWorldMaterials`, so every GLB prop is a facet material. Fixed.

**M2. Terrain blend and `flatShading` cannot coexist.** With `FLAT_SHADED` defined, three does not declare `vNormal` (`normal_fragment_begin.glsl.js` 4-12), so "`terrainMaterial` opts into cut with the blend" would not compile. Fix: the blend variant keeps `flatShading` off and computes the face normal itself from `dFdx(vViewPosition)`; written into 6.1 and LT4, with a test. Fixed.

**M3. A moving sun makes shadows shimmer.** Texel snapping stops crawl from the camera moving, but a sun that turns every frame rotates the shadow map's grid, so every edge swims all day. Games with a day cycle update the shadow direction in steps. Fix: the shadow light's direction is quantised (it moves only when the true sun is more than 0.5 degrees away, about every 2 s at the proposed clock); a shadow-fit test pins it. Fixed.

**M4. Instanced systems would be culled by their bounding sphere.** The carpet, motes and weather place instances in the vertex shader; their instance matrices are identity, so `InstancedMesh.computeBoundingSphere` (`InstancedMesh.js` 75-90) gives a tiny sphere at the origin and three culls the whole system when the origin leaves the view. Fix: `frustumCulled = false` on the carpet, motes and weather sets, written in GR6 and WX3. Fixed.

**M5. The governor could fight the player.** A 30 Hz panel, a laptop on battery or a background tab gives slow medians; "the player's choice is respected until the next slow window" then steps them down again 4 s later. Fix: the governor ignores windows in which the page was hidden, and stops for the session once the player picks a tier by hand. Fixed.

**M6. Plain mode cannot rebuild materials that already compiled.** `onShaderError` fires after programs exist; a flag read by `facetMaterial` affects only new materials, and three keeps the failed program for the old key. Three also stops logging the error itself once the handler is set (`WebGLProgram.js` 936-938). Fix: patched materials register in one list; `enterPlainMode` swaps each to a stock `MeshLambertMaterial` with the same colour, map and emissive, and the handler logs the shader log before switching. Fixed.

**M7. Slice order put water before ground.** The owner asked for the environment specifically; vegetation and place-making are the larger part of that, and merging (GR2) is what pays for the new draws. Fix: order is light, air, ground, water, weather, effects; dependencies rewired (GR1 after AR, WT1 after GR7, WX1 after WT3). Fixed.

**M8. LT5 and AR4 were too large to verify.** LT5 touched nine files and three concerns (rig and clock, shadow fitting, cut-world opt-in); AR4 combined the output path with the governor and plain mode. Fix: LT5 splits into LT5a (rig, clock, shadows) and LT5b (cut world, `spawnWorldProp`, terrain diagonal); AR4 into AR4a (output path and pixel budget) and AR4b (governor and plain mode). Fixed.

**M9. R0 did not stop on missing Stage 2 data.** On `feat/world-place`, `PATHS`, `RIDGES`, `BASINS` and `POIS` are still empty arrays (`worldMap.ts` 72-75). Scatter, poses, the ground field and the water grid read them by name. Fix: R0 checks that each table is non-empty and that every POI id the design names exists; if not, the stage stops. Fixed.

**M10. Bloom output pass was hand-written.** The plan wrote a custom `ShaderPass` for tone mapping, colour space, vignette and dither, while the design listed `OutputPass`. Fix: stock `OutputPass`; the sky gets `dithering: true` (three's own `dithering_fragment`) against banding; the vignette is cut (no owner would miss 6%). Fixed.

**M11. Scatter could stack instances.** The scatter rules forbid placements near gameplay objects but not on top of each other. Fix: Poisson-disk minimum spacing per piece (H10), with a test that no two instances of the understorey or canopy layers are closer than the larger piece's radius. Fixed.

### Low

**L1.** Terrain joins the shadow pass with only `bias`; terrain self-shadowing at a low sun needs `normalBias`. Written into LT7's knobs. Fixed.

**L2.** `mergeGeometries` rejects a mix of indexed and non-indexed geometries. GR1 gains that case and GR2 converts as needed. Fixed.

**L3.** On the composer tiers the canvas keeps its own multisampled buffer (antialias is fixed at context creation) beside the composer's: two MSAA buffers. Written in 6.10 with the megapixel caps as the bound. Fixed.

**L4.** Kestrel Bluffs, left "as a Stage 5 option" by the foundation design (its review table, item 26), was not named. The design now declines it with the scenic ridge. Fixed.

**L5.** `materials.ts` 3 still says "tokens inspired by" another game in a comment. Out of scope (existing content), noted for the owner's deny-list sweep; not changed.

## Things checked and found sound

- Approach B for light (replace `lights_lambert_pars_fragment`, keep three's light loop) is feasible in r169 and gives shadows, hemisphere and point lights for free (P10).
- The four declared test replacements are justified: the two in `tests/textures.test.ts` pin the very defect (they assert the Lambert sum is absent); `tests/globals.test.ts` requires more than ten `onclick` calls, which cannot survive removing them; `tests/vercel-headers.test.ts` compares the policy by exact string.
- `ShaderMaterial` gets three's tone-mapping and colour-space functions (`WebGLProgram.js` 832-839), so `COLOR_FOOTER` works.
- The `#define getShadow` wrapper compiles if the wrapper is declared before the define (its body is then not expanded); the fallback stays.
- Lane allowlists do not collide; `runtime.ts` is shared only in sequence.
- The five findings deferred to Stage 5 (23, 24, 30, 31, 32) and the script policy of finding 5 all have tasks.
- Model tiers follow the rules: opus only on verify, chunk edits, boundary tests, look tuning and licence work.

## Owner decisions

These were left open on purpose; each has a recommendation. The design's section 13 holds them as CALL-V18 to CALL-V20 next to the existing CALLs, and section 15 as QV6 to QV8.

1. **D1 (CALL-V18): tier names.** Rename the button's four labels to Low, Medium, High, Ultra (internal ids unchanged)? Recommendation: yes; it is what you asked for, and nothing is saved by name.
2. **D2 (CALL-V19): texture crispness.** Keep smooth magnification of the 256-pixel tiles, or make texels crisp up close (nearest magnification, smooth at a distance)? Recommendation: show both at the light checkpoint; crisp texels are the "old school, but sharp" look many retro-modern games use, and the change is one constant.
3. **D3 (CALL-V20): fixed frame-time targets.** After the baseline is measured on your computer, accept the budgets as written or let the lead adjust them to what your GPU can do? Recommendation: let them be adjusted once at OV-2, then frozen.
4. **QV1 (CALL-V3): running day clock or three fixed times.** Recommendation: running clock.
5. **QV2 (CALL-V13): remove the inline click handlers and turn on the strict script policy now, or with Stage 7.** Recommendation: now.
6. **QV3 (CALL-V9): woods made of undergrowth plus tall trees only outside the walkable area, or trees that block movement.** Recommendation: non-blocking.
7. **QV4 and QV5: the two fonts once shown, and which computer and screen are the reference for speed.** Recommendation: answer at UI1 and OV-2.
