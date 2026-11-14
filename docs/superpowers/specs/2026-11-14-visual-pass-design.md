# Visual pass: design

Date: 2026-11-14. Branch: `feat/visual-pass`. All line numbers refer to commit `a8cad85` (main, before Stages 2, 3 and 4). Symbols are named next to every line number, because the lines will move before this stage starts.

Status: proposal, approved in part. On 2026-11-14 the owner answered CALL-V3, V9, V18, V19 and V20 and agreed how QV4 and QV5 will be answered; section 13 marks each one decided, with the answer. Every other **CALL-V** is still the lead's proposal and needs the owner's check. The owner chose trees that block walking in the woods against the lead's recommendation; section 6.11 is the design for it.

Inputs read for this document: `docs/superpowers/specs/2026-11-13-world-foundation-design.md` (called "the foundation design" below; its sections 6, 8 and 9 in particular) and its plan; `docs/audit/2026-11-13-findings.json`; `docs/superpowers/baseline/` (the two screenshots, the Stage 1 baseline, the CP-1 and G-2 records); `src/engine/renderer.ts`, `worldMesh.ts`, `worldBuild.ts`, `blenderWorld.ts`, `textures.ts`, `materials.ts`, `vfx.ts`, `overlay.ts`, `spawns.ts`, the render part of `loop.ts`; `src/ui/hud.ts`, `stations.ts`, `styles.css`; `index.html`; `vercel.json`; `CREDITS.md`; the tests that pin rendering or markup (`tests/textures.test.ts`, `globals.test.ts`, `vercel-headers.test.ts`, `source-limits.test.ts`, `architecture.test.ts`, `credits.test.ts`); the JSON chunk of `public/models/world.glb`; three 0.169 sources under `node_modules/three`; the Stage 2 data file on `feat/world-place` (`src/data/worldMap.ts`); for 6.11 (added 2026-11-14), the Stage 2 walking code and tests on `wp/W` and `feat/world-place` (`src/state/collision.ts`, `terrain.ts`, `pathfind.ts`, `monsterAi.ts`, `save.ts`, `src/data/worldMap.ts`, `placements.ts`, `tests/reachability.test.ts`, `relief.test.ts`, `world-data.test.ts`, `pathfind.test.ts`); and the shelved Stage 7 compression design on `feat/reach`.

Nothing was run: no test, no build, no dev server, no browser. Every frame cost in this document is an estimate. Section 15 lists what could not be verified.

This is Stage 5 of the owner's program. It lands after Stages 2, 3 and 4 and builds on the Stage 2 world (relief, four paths, Harrowback Ridge, Cinderstep Pass, two ponds, seven points of interest, terrain at 160 segments).

---

## 1. Intent and why

The owner's words (translated): "it is an old-school game, but that does not mean it has to be shallow in visuals; it can be an old school 8k", with a specific request that the game's environment become better. Stage 5 as written: "light, shadow, atmospheric depth, vegetation, particles, and an interface with its own typography and identity."

Reading: keep the faceted, old-school identity, and make everything around it rich and deliberate. The picture today (`docs/superpowers/baseline/shot-03-noon.jpg`, `shot-04-peak.jpg`) is dark, flat and empty, and reading the code explains why. These five facts decide the design.

1. **Nothing in the world is lit by the scene's lights.** `facetMaterial` (`materials.ts` 116-167) replaces Lambert's `outgoingLight` (three's `meshlambert.glsl.js` line 114) with `diffuseColor * mix(coolTint, warmTint, cel)`, where `cel` comes from a light direction written into the shader text: `vec3(0.52, 0.78, 0.34)` (`materials.ts` 159-163). `reflectedLight` is thrown away. So the sun, the hemisphere light and the ambient light created in `init3DEngine` (`renderer.ts` 133-153) change nothing on any surface built with `facetMaterial`, `albedoMaterial` or `terrainMaterial`, which is nearly every surface. `tests/textures.test.ts` 109-111 asserts that the Lambert sum is absent.
2. **Shadows are rendered and almost never shown.** The shadow term lives inside the discarded `reflectedLight`. A 2048 shadow map is drawn every frame (`renderer.ts` 141-151, `loop.ts` 502-504) for every `castShadow` mesh, and no facet surface uses it. The only exception is the 13 small props placed by `spawnWorldProp` (`worldBuild.ts` 580-603, barrels, crates, produce): it never calls `applyWorldMaterials`, so they keep the GLB's `MeshStandardMaterial` and do receive shadows (critique P2b). Both screenshots agree: no tree, building or figure casts a visible shadow on the ground. This cost is also invisible in the perf HUD: three resets `renderer.info` after the shadow pass (`WebGLRenderer.js` 1216 and 1222), so the 1509 "calls" of the baseline count the colour pass only.
3. **Time of day changes the sky and the fog colour, nothing else.** `cycleTimeOfDay` (`worldMesh.ts` 70-96) writes three sky colours and a fog colour. At "Starry Night" the world keeps its noon shading under a dark sky. "Golden Hour" is a grey sky (`0x8a8a92`).
4. **The custom shaders skip the colour pipeline.** The sky (`worldMesh.ts` 52-63), the water (134-164) and the grass (`materials.ts` 169-217) write `gl_FragColor` directly, with no tone mapping, no colour-space conversion and no fog. Their authored colours come out darker than written, the far water and far grass are not fogged, and the grass shades with a second copy of the fixed light direction (176). The black spikes in `shot-03-noon.jpg` are these grass blades.
5. **Draw calls, not triangles, are what the world spends.** `world.glb` holds 433 meshes in 29 props (JSON chunk: a tree is 10 to 22 meshes over 2 to 4 materials, the castle 68 meshes over 5, the bridge 41 over 3; 41,776 triangles in total). `cloneWorldNode` (`blenderWorld.ts` 120-143) keeps every mesh separate and clones its geometry per instance (51). The start pose draws 1509 calls for 226k triangles: about 150 triangles per call.

And three smaller ones: there are 900 grass blades of one triangle each over 46,000 square units (`worldMesh.ts` 172-196); "faceted" is not what the shader does today, because `facetMaterial` shades smooth normals unless a caller passes `flatShading: true`, which only crystals and ore veins do (`materials.ts` 110-115); and the interface is set in the system font with two fallback serif stacks (`styles.css` 36, 222, 300) and colour tokens named after two other games (`styles.css` 2-13).

So the stage is not "add effects". It is: give the world a real light, let the shadow that is already paid for be seen, give the air depth, fill the ground, and pay for it with the draw calls that merging frees.

### Essence to preserve (CALL-V1)

The foundation design's CALL-1 list, unchanged: skills on the current XP curve, click-to-act, 28 slots, bank, shops, forge, saves keep loading. For the look: **flat planes, painted albedo tiles, a limited palette, hard edges.** No photoreal material, no normal or roughness map, no soft particle sprite, no depth-of-field, no motion blur.

One game rule changes in this stage, by the owner's decision of 2026-11-14 (CALL-V9): the trees the stage adds in the woods block walking (6.11). This changes walkable cells in the woods, so routes and monster chases there bend around trunks. Nothing else here changes a height, a walkable cell, a monster, a drop, a formula or the save format.

---

## 2. Constraints

| # | Constraint | Consequence |
|---|---|---|
| K1 | The browser must run it. WebGLRenderer of three ^0.169 (WebGL2 only since r163), one static site, no server. | Every feature has a cost, a quality tier and a fallback (section 10). A tier governor steps down when frames are slow (6.10). |
| K2 | Players download 3.76 MB of models (Brotli) and about 931 kB of JS (measured, given). | No new model is essential (6.7). JS grows by at most 80 kB minified over the chunk measured after Stage 4; fonts are at most 120 kB; reasons in section 10. |
| K3 | Blender 5.0.1 is installed, headless. A new or changed model is a cost, and every node name, pivot, scale and material name the engine looks up must stay. | `world.glb` and the other four GLBs are not rebuilt and stay byte-identical. Merging is done at run time (6.6). The only Blender work is optional (CALL-V8). |
| K4 | No new runtime dependency. Post-processing comes from three's own examples. | `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass` and `BufferGeometryUtils` are files inside the `three` package that is already installed and locked. `package.json` `dependencies` does not change. |
| K5 | Third-party assets need a redistribution licence recorded in `CREDITS.md`, self-hosted. The site sends a Content-Security-Policy (`vercel.json`). | Fonts are woff2 files in the repository, loaded from the same origin. No request leaves the origin. No third-party texture is added: noise is computed in the shader. |
| K6 | New content gets original names and an original look. Nothing new is named after or modelled on RuneScape or Zelda. | New CSS tokens do not extend `--osrs-*` or `--botw-*`; those two families are renamed away (7.2). The interface style is the game's own (section 7). Existing borrowed names in content are out of scope (foundation design Q2). |
| K7 | Vitest runs in `node` with no DOM (foundation design C4). | Everything claimed as an automated proof is DOM-free: pure functions, data tables, shader text, and text scans of `index.html` and the CSS. What needs eyes is a screenshot check at a fixed pose (section 8). |
| K8 | Existing tests are frozen (plan rule 0.3.3). | Stage 5 collides with two assertions on purpose and declares the replacements in advance (8.3). Two more are conditional on CALL-V13. |
| K9 | No file under `src/` over 1000 lines; every module imports in `node` without throwing; `src/state` and `src/data` do not import `three`. | New engine modules are small and have no import-time side effect. Pure look data and pure math live in `src/data` and `src/state`, where they can be tested. |
| K10 | Out of scope: combat feel and sound (Stage 4), quests and new systems (Stage 6), touch controls (Stage 7). | Effects are restyled, never retimed (6.9). The interface keeps its layout and its mouse and keyboard model. |
| K11 | The saved `timeOfDay` is an integer 0, 1 or 2 (`save.ts` 47-50). | The day clock is engine state. The save keeps writing 0, 1 or 2 (section 9). |
| K12 | Walkability is Stage 2 game state: `isWalkable` (`collision.ts`) feeds the walk grid (built once), click-to-move, keyboard and monster movement, save relocation, and the frozen Stage 2 tests. | The woods trees enter walkability as a committed table of whole walk cells, identical on every load and every tier (6.11). Every frozen Stage 2 test stays green untouched. |

---

## 3. Goals, non-goals, anti-goals

Goals, each with its proof in 8.1:

- **G5.1** One light model: the sun, the sky fill and the ground bounce shade every world and character surface, and all of them follow the time of day.
- **G5.2** Shadows are visible, stable when the hero walks, and fade out before their range ends. The ridge casts one.
- **G5.3** A continuous day: dawn, day, golden hour, dusk and night are different pictures of the same place. The save format does not change.
- **G5.4** Atmospheric depth: near, middle and far read as three planes at every pose; fog has height and leans toward the sun.
- **G5.5** Water that has a shore, a depth and a sky in it, in facets.
- **G5.6** Dense and varied vegetation placed by rules, so the five regions and the seven points of interest read as places. No path, pad, pass or station is obstructed. In the woods, trees block walking (6.11), and every place the player could reach before stays reachable.
- **G5.7** Weather and ambient particles in the faceted idiom, bounded per tier.
- **G5.8** The world looks composed from any camera angle the game allows: no visible map edge, no void, a closed horizon.
- **G5.9** Crisp at high resolution and high pixel ratio: edges, shadows, text, icons and the minimap.
- **G5.10** An interface with its own type system, colour and component language. No token, class or font named after another game.
- **G5.11** The interface is usable by keyboard and readable: audit findings 24, 30, 31 and 32 are resolved.
- **G5.12** The budgets of section 10 hold on every tier, and the game picks a lower tier by itself when frames are slow.
- **G5.13** A shader that fails to compile does not leave a black screen.
- **G5.14** Every audit finding this stage touches (23, 24, 29, 30, 31, 32) is fixed or deferred again in writing (section 11).

Non-goals: new relief or a second ridge (the foundation design's option of a scenic ridge east of the river, and Kestrel Bluffs, left there "as a Stage 5 option", are both declined: they would change the terrain golden); collision on any decoration other than the woods trees of 6.11 (bushes, rocks, logs, reeds and the canopy on unwalkable ground never block); new creatures, items or places; renaming borrowed content; changes to animation or to the timing of any effect; sound; a settings store for the graphics tier; texture streaming; a level-of-detail system for models; model compression (Stage 7, shelved by the owner).

Anti-goals:

- No physically based materials, no normal maps, no screen-space ambient occlusion, reflection or global illumination pass. They cost a second scene pass and pull the look away from planes.
- No soft sprite particle, no lens flare, no chromatic aberration, no film grain. Bloom is the only glow, and only on emissive things.
- No new texture download for noise, clouds or water. No third-party request at run time.
- No rewrite of the HUD's structure or of `stations.ts`' render functions; they are restyled and fixed in place.

---

## 4. Approaches

### 4.1 Where the light comes from

| | A. Keep the fixed direction, pass it as uniforms and animate it | B. Use three's own lights through the Lambert pipeline, with a banded response (recommended) | C. Move to `MeshStandardMaterial` |
|---|---|---|---|
| What | The shader keeps computing its own `ndl`; sun direction and two tints become uniforms. Shadows need a hand-written shadow lookup. | Keep `MeshLambertMaterial` and `onBeforeCompile`. Replace the chunk `lights_lambert_pars_fragment` so the direct term is banded, and stop discarding `reflectedLight`. | Physically based shading. |
| For | Smallest diff. | Shadows, the hemisphere fill, the ambient term and point lights arrive through code three already has and maintains. Time of day is "animate the lights". The shadow term is already inside `directLight.color` when `RE_Direct` runs (`lights_fragment_begin.glsl.js` 145). | Standard. |
| Against | Rebuilds shadows and every extra light by hand. | Depends on the text of three's chunks, so it is pinned by tests and by the `^0.169` range staying on 0.169. | More expensive per pixel, and a different look: specular highlights and smooth falloff are the opposite of planes. |

Recommendation: **B**.

### 4.2 Shadows that hold up

| | A. One map, fitted and snapped, with a distance fade (recommended) | B. Cascaded shadow maps (`three/examples/jsm/csm`) | C. Baked shadows |
|---|---|---|---|
| For | One shadow pass (it is paid today). Snapping the light to the map's texel grid removes the crawl. A fade hides the end of the range. | Sharp near, present far. | Free at run time. |
| Against | Nothing beyond the range (40 to 70 units by tier); the fade and the air cover it. | Two or three shadow passes over every caster; `CSM.setupMaterial` assigns `material.onBeforeCompile` and would overwrite the facet shader's hook. | The sun moves. |

Recommendation: **A**. The live camera pitch runs from 0.12 to 1.15 rad (`input.ts` 114) and its distance from 3.6 to 26 units (`input.ts` 125); `sanitizeCam`'s 0.42 and 9.5 only clamp a camera read from a save. At high pitch the view footprint is small and inside the range; at low pitch the ground beyond the range is seen at a grazing angle and through air, where the fade and the air hide the end. A far cascade would buy little.

### 4.3 Depth and glow

- **Fog (recommended): in the material, not as a pass.** A fog function with height and sun lean replaces `fog_fragment` inside the facet shader and is included by the sky, water, grass and particle shaders. No depth pre-pass, no second scene pass. Rejected: a depth-based full-screen fog pass (needs a depth texture and breaks with transparent water), and a global patch of `THREE.ShaderChunk` (it would reach materials that have no uniforms for it).
- **Ambient occlusion (recommended): none as a pass.** Grounding comes from visible shadows and a per-prop "foot" gradient (5.3). Rejected: `GTAOPass` (16.6 kB of source and a normal pass over the scene).
- **Bloom and output (recommended): three's `EffectComposer` with `UnrealBloomPass` and the stock `OutputPass`, on the two upper tiers only.** About 30 kB of source (`EffectComposer` 4.7, `RenderPass` 1.9, `ShaderPass` 1.6, `Pass` 1.7, `MaskPass` 2.2, `CopyShader` 0.6, `UnrealBloomPass` 12.4, `LuminosityHighPassShader` 1.1, `OutputPass` 2.5, `OutputShader` 1.5), estimated at 14 kB minified. Rejected: a post-processing library (a new dependency, K4).

### 4.4 Paying for vegetation

| | A. Merge static props by material at load, instance the new dressing, keep the GLB (recommended) | B. Rebuild `world.glb` in Blender with one mesh per prop and baked vertex colour | C. Leave props as they are and add less |
|---|---|---|---|
| For | No model changes (K3). `mergeGeometries` is in three's examples. A 13-mesh tree becomes 2 draws. | Fewer bytes of JS. Baked occlusion possible. | No risk. |
| Against | Per-instance merged geometry uses more GPU memory than instancing would. | Changes every node the engine looks up by name and material; risks K3. | Does not reach G5.6 inside a draw-call budget. |

Recommendation: **A**.

### 4.5 Where new vegetation models come from

- **A (recommended): built in TypeScript**, as small jittered polyhedra with vertex colours (`floraKit.ts`): boulders, bushes, ferns, reeds, logs, snags, saplings, backdrop trees, crags, clouds. Zero model bytes, deterministic, and jittered low-poly solids are exactly the idiom.
- **B: a new `flora.glb` from a Blender script.** Authored shapes, about 60 to 90 kB on the wire (estimate), one more fetch, one more pipeline step.

A first; B stays an option if the crags or backdrop trees read as blobs at the owner's check (CALL-V8).

### 4.6 The interface

- **A (recommended): restyle in place.** New tokens, self-hosted fonts, a component language in CSS, markup fixed where the audit says so. `hud.ts` and `stations.ts` keep their render functions.
- **B: rebuild the HUD from components.** Not asked for, and it would put every station flow at risk for a visual gain A already delivers.

### 4.7 How established games and engines solve the same problems

Borrowing a technique is the point of this table; copying a game's names, characters, maps or look is not (K6). Each row names the established technique, where it is commonly used, and why it fits or does not fit a WebGL browser game with a faceted look.

| Problem | Established techniques (where used) | This design | Why it fits WebGL and this look |
|---|---|---|---|
| Shading model | Toon or banded diffuse inside the engine's light loop (Godot's toon diffuse mode, Unity URP custom-lighting toon shaders, many cel-shaded console games); a 1D ramp texture indexed by N·L; full PBR (most modern engines) | Banded Lambert by replacing three's `RE_Direct_Lambert`, thresholds in constants (4.1 B) | Same idea as engine toon modes: the engine still evaluates lights and shadows, only the response curve changes. A ramp texture would be equivalent; constants are testable as text and need no asset. PBR rejected: cost per pixel and smooth highlights work against planes. |
| Faceted look | Flat shading by face normal (low-poly indie games and city builders); smooth normals with stylised lighting; mixed: cut environment, rounder characters (common in stylised RPGs) | Cut world, round figures; terrain normal blended 70% toward the face normal (5.1) | Face normals from screen derivatives cost nothing extra in WebGL2. The terrain blend avoids the band flicker that pure flat terrain shows at a low sun, a known problem of flat-shaded heightfields. |
| Shadows | Cascaded shadow maps (open-world games in Unreal and Unity); one stable, texel-snapped map fitted to the view (top-down and third-person games with a limited camera, many MMOs at low settings); baked lightmaps plus dynamic character shadows; shadow direction updated in steps under a day cycle | One fitted, texel-snapped map with a distance fade; sun direction for shadows quantised (6.2) | CSM costs 2 to 3 extra shadow passes in a draw-call-bound browser game, and three's `CSM` overwrites the facet hook. Baking fails with a moving sun. Stepped sun direction is the standard cure for shimmer under a day cycle. |
| Fog and atmosphere | Exponential height fog with directional inscattering (Unreal's Exponential Height Fog); aerial perspective from a scattering model (Frostbite, Unreal Sky Atmosphere); depth-based post fog | Per-material height fog with sun lean, `applyAir` (6.3) | This is height fog with directional inscattering, done per material. A scattering model or a post fog needs a depth pass or lookup tables: too costly and too photographic. Per-material fog adds a few ALU operations and no pass. |
| Vegetation density and placement | GPU-instanced grass on a camera-relative wrapping grid driven by a density map (Unity terrain details, Unreal landscape grass types, many open-world grass systems); rule-based procedural placement with Poisson-disk spacing under masks (Unreal PCG, Houdini scatter pipelines, GPU placement in large open-world games); hand placement | Carpet: instanced tufts wrapping around the hero, density from a ground-field texture (6.7). Scatter: rules per region and POI, Poisson-disk spacing inside seeded clusters | The carpet is the standard camera-relative grass technique with no CPU work per frame. The scatter originally invented its own clustering; it now uses Poisson-disk spacing (even, never overlapping) inside clusters, which is what placement tools do. Hand placement would not scale to five regions. |
| Water | Stylised water with a depth ramp and shoreline foam from the depth buffer (common Unity and Godot stylised water shaders); flow maps for rivers (Valve's flow-map water); planar or screen-space reflection | Depth per vertex from the terrain height, foam band, flow vector per vertex, Fresnel toward sky colours (6.5) | Same look as depth-buffer water without a depth texture: depth is precomputed because the terrain is static. Per-vertex flow is a flow map baked into the mesh. Reflections need a second scene pass, rejected (anti-goals). |
| Sky and day cycle | Keyframed colour gradients over time of day (most stylised games, Unity gradient skyboxes); physically based sky (Preetham or Hosek-Wilkie, three's `Sky` example) | Six keys interpolated in OKLab, a gradient dome with stepped discs (5.3, 6.4) | Keyframes are art-directable and cheap; a physical sky is photographic and hard to push toward a palette. OKLab avoids grey midpoints on warm-to-cool transitions. |
| Level of detail and draw calls | Static batching by material (Unity), GPU instancing for repeated props, multi-draw batching (three's `BatchedMesh`, core since r159), HLOD and billboard impostors for far trees (SpeedTree-style) | Merge each prop's meshes by material, instance all new dressing, no LOD (6.6, 6.7) | Per-prop merging keeps one object per prop, which raycasts, outlines and the live and depleted swap rely on. `BatchedMesh` (one draw per material for the whole world, per-instance visibility) is the next step if the call budget is missed; it is not taken now because it changes how clicks find props. Triangles are cheap here and the view is short, so LOD and impostors buy little. |
| Dynamic resolution | Continuous dynamic resolution scaling from GPU timers (console games, Unreal DRS); discrete quality steps (many PC and browser games, Babylon.js's scene optimiser) | A pixel budget per tier and a governor that steps down one tier (6.10) | In WebGL a resolution change reallocates the drawing buffer and hitches, and GPU timer queries are missing on some browsers, so continuous scaling is a poor fit. Discrete steps, rarely taken, are the browser-safe version. |
| Glow | Threshold bloom on HDR (Unreal, Unity URP); selective bloom by layers (three's selective-bloom example, two scene passes) | `UnrealBloomPass` with a threshold above the brightest lit surface, high and ultra only | Threshold bloom is one chain of half-resolution passes; selective bloom doubles scene rendering. The threshold rule (6.10) is what keeps it to emissive things. |
| Contact grounding | SSAO or GTAO (most PC games); baked vertex AO; a darkening gradient toward the base of props (common low-poly trick) | Foot gradient (5.2) | The gradient is fake ambient occlusion at zero cost, and reads as planes. SSAO needs a normal and depth pass. |
| Particles | Stateless GPU particles animated from a seed and time (common for ambient weather); CPU particle systems | Instanced flat shapes animated in the vertex shader (6.8) | No CPU work per particle and no buffer upload per frame. |
| Interface | Nine-slice panel frames (most game interfaces); a display face plus a text face; bitmap fonts in retro games | Chamfered panels by `clip-path`, two self-hosted faces (section 7) | `clip-path` is the CSS form of a cut nine-slice frame with no image to download; CSS `border-image` (a true nine-slice) stays available if the owner wants ornament. Vector fonts stay sharp at every interface scale, which bitmap fonts do not. |

Not taken, and why: screen-space light shafts (one more post pass; can be added to ultra later), volumetric clouds (raymarching cost), texture streaming (the whole texture set is small).

---

## 5. Art direction

Working title for the look: **"Cut world, round figures, real air."** A team can follow these rules without the lead in the room.

### 5.1 Form: what is cut and what is round (CALL-V2)

- **The world is cut.** Terrain, rock, masonry, timber, foliage, props, clouds and water are shaded per triangle: one normal, one tone per plane. Light changes from plane to plane, never across one.
- **Figures are round.** The hero, guards, monsters and worn gear keep smooth normals and a two-band response. The hero and monster meshes are dense (monsters: 98,644 triangles in 399 meshes), and flat shading on dense meshes reads as noise; a face needs a soft turn. This also separates what acts from what stands: a round figure in front of a cut world is readable at a glance, which click-to-act needs.
- **Facet size has a floor.** A plane that covers fewer than about 6 pixels on screen is noise. New geometry keeps planes large: a boulder is 12 to 20 triangles, a bush 20 to 40, a backdrop tree under 80.
- **Terrain facets are softened, not smoothed.** The terrain shades with a normal blended 70% toward the flat one, and the triangle diagonal alternates like a checkerboard, so gentle ground does not flicker between bands and no diagonal grain runs across the map. The blend is the one tuning knob.
- **Edges are hard.** Shadow edges are one to two texels wide. Sun, moon and cloud edges are steps. The optional ink outline stays what it is: off by default, a player's choice.

### 5.2 Light and shadow language

- **Three sources, always.** A warm **key** (sun or moon), a cool **fill** from the sky hemisphere, a dull **bounce** from the ground hemisphere. No surface is ever lit by the key alone, and no shadow is ever black.
- **Bands.** The key lands in three steps by the angle to the plane: full (cosine above 0.55), half (0.15 to 0.55, 62% of key), grazing (0 to 0.15, 22%), each step 0.04 wide. Round figures use two steps (0.35). Shadow multiplies the key only.
- **Shadows are sky-coloured.** A shadowed plane shows albedo times fill plus bounce. At noon that is blue-leaning, at golden hour violet, at night deep blue. Measured target at noon on meadow grass: lit value 55 to 65% (sRGB), shadowed 30 to 38%, so the ratio stays near 1.7 to 1.
- **The sun never stands overhead.** Maximum elevation 62 degrees, so everything always throws a shadow with length. Below 12 degrees the cast direction is clamped and the key fades, so shadows do not stretch to infinity.
- **Everything darkens toward its foot.** Props and vegetation lose up to 25% of value in their lowest 0.6 units. This grounds them where the shadow map has ended.
- **Emissive things are small and saturated**: lantern glass, forge mouth, lava seams, runes, mushroom caps, spell cores. They are the only things that bloom, and at night they carry the picture. From the high tier up, the nearest of them also light the ground (6.8).

### 5.3 Time of day

One continuous clock. Phase 0 is midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset. Six keys, interpolated in OKLab so mixes do not go grey:

| Key | Phase | Sun elevation | Key colour, intensity | Sky zenith | Sky horizon | Air (fog) | Fill | Bounce | Exposure |
|---|---|---|---|---|---|---|---|---|---|
| Night (moon is the key) | 0.00 | moon at 50 | `#8fa8d8`, 0.35 | `#0b1226` | `#1c2b4a` | `#18243c` | `#2a3a66` | `#141a22` | 1.25 |
| Dawn | 0.25 | 4 | `#ffb38a`, 0.9 | `#3a4f86` | `#f2b08c` | `#c9a9a0` | `#6f7fb0` | `#4a3f3a` | 1.10 |
| Morning | 0.33 | 28 | `#ffe2b8`, 1.6 | `#3f78c2` | `#bcd6ea` | `#b5cde0` | `#8fb2dc` | `#5a5a48` | 1.00 |
| Noon | 0.50 | 62 | `#fff4dc`, 2.0 | `#2f6fc4` | `#a9cdea` | `#a8c6e0` | `#9cc0ea` | `#6a6a4e` | 1.00 |
| Golden hour | 0.70 | 16 | `#ffc070`, 1.7 | `#3b5fa6` | `#f6c98a` | `#e2b890` | `#7f8fc4` | `#5c4a38` | 1.05 |
| Dusk | 0.77 | 2 | `#ff8a5c`, 0.8 | `#2c3470` | `#f08a6a` | `#a8788a` | `#5a5c9c` | `#3a2f38` | 1.15 |

These values are a starting point. The look-development task tunes intensities against the measured targets of 5.2; hues are the direction to keep. Rules behind the table:

- The horizon always carries the key's hue, the zenith its complement. The air colour sits between horizon and fill, so distance always fades toward the sky that is behind it.
- **Night is blue, not black (CALL-V4).** Under the moon, lit ground stays at or above 22% value and text over the world stays readable. Night is a mood, never a penalty: no rule depends on it.
- Continuity with today: near phase 0.58 the sun passes within 5 degrees of today's fixed direction (0.52, 0.78, 0.34), so the afternoon picture is the one the game has always had, now with shadows.

### 5.4 Atmosphere and distance

- **Three planes.** Near (0 to 25 units): full saturation and contrast. Middle (25 to 90): contrast falls, hue drifts to the air colour. Far (beyond 90): silhouette in air colour, at most two tones. The horizon apron (6.4) is always "far".
- **Fog has height.** It is densest below 2 units above the water plane and thins by half every 9 units up. It pools in the river trough and the two ponds, and the top of Harrowback Ridge stands clear of it.
- **Fog leans to the sun.** Looking toward the key, the air takes the horizon colour; away from it, the fill colour. This alone makes a turn of the camera change the picture.
- **Each region tints its air** (5.5) by at most 20%, blended by distance to the region centre, so walking from the meadow to the dunes changes the light before any landmark arrives.

### 5.5 Palette per region

Regions are named by their ids in `WORLD_REGIONS` (`catalog.ts` 431-436). Each has a ground family, a foliage family, one accent that appears nowhere else, and an air tint. Albedo stays inside 25 to 75% value; the light does the rest.

| Region id | Ground | Foliage | Accent (unique) | Air tint | What grows and lies there |
|---|---|---|---|---|---|
| `lumbridge` (start valley) | Yellow-leaning meadow greens, warm dirt | Mid greens, round crowns | Poppy red (flowers, the goblin camp's cloth) | Neutral | Tall meadow grass, flower drifts, hedges, fence-line weeds, river reeds |
| `varrock` (east plaza) | Cool cobble greys, slate | Dark clipped greens | Crimson and brass (banners, trim) | Slightly cool | Short grass, weeds between cobbles, planters, ivy at wall feet |
| `desert` (dunes) | Ochre and pale sand; shadows go violet | Dusty olive, sparse | Tamarisk pink (blossom at the pool) | Warm, dusty | Dry tussocks, thorn scrub, bleached snags, wind-cut stones |
| `woods` (deep woods) | Dark moss, leaf litter | Blue-greens, tall and dense | Lantern amber, with mushroom cyan and violet as glow | Green-blue, thick | Ferns, saplings, fallen logs, mushroom rings, hanging moss, fireflies at night |
| `wilderness` (volcanic corner) | Basalt charcoal, ash, purple-brown | Almost none: burnt snags, ash grass | Ember orange (seams, sparks) | Grey-violet, ashy | Ember grass, burnt trunks, obsidian shards, falling ash |

Between regions the ground families blend over 14 units, as the terrain shader's biome weights already do (`TERRAIN_SAMPLE`, `textures.ts` 416-443).

### 5.6 Vegetation and props: how a place reads as a place

Five layers, each with one job:

1. **Carpet** (grass tufts, flowers, dry tussocks, ember grass): tells the region and the wind. It follows the hero and fades out at its edge (6.7).
2. **Understorey** (bushes, ferns, reeds, small rocks, logs, mushrooms; at most 1.2 units high): tells the ground under it. Reeds only within 3 units of water. Ferns only in `woods`. Never on a path.
3. **Canopy and crag** (backdrop trees, crags, snags; tall): closes views and frames them. It stands **only on ground the hero cannot walk on** (`isWalkableGround` false): the 12-unit border ring between the walkable bound (118) and the terrain edge (130), the core of Harrowback Ridge, and the far bank strips the walk grid already blocks. It never blocks anything, because nothing could walk there.
4. **Woods trees** (tall trunks with crowns, `woods` region only; CALL-V9, decided 2026-11-14): make the woods a forest the hero walks through. Each stands on one walk cell and **blocks it** (6.11). They are a fixed, committed table, not part of the scatter, and the same on every tier. Outside the woods, tall things still never appear where the hero could walk.
5. **Horizon** (a ring of far hills beyond the terrain): closes the picture at every yaw.

Distribution rules:

- **Clumps, not noise.** Instances come in clusters of 3 to 9 around seeded cluster centres with a size falloff, largest in the middle. Even spacing is forbidden.
- **Paths are edged.** A path keeps a bare strip of its half-width, then a verge of denser, taller carpet for 2 units. A path reads as a path because of what grows beside it.
- **Every point of interest gets a frame, a focus and a floor.** Frame: two or three tall things behind it (canopy layer, on unwalkable ground where the map allows, otherwise understorey at its tallest). Focus: its existing pieces, kept clear by an empty radius equal to `padRadius`. Floor: a ground change (trampled dirt at Three Kettle Camp, ash at Slagfall Terrace, moss at Lampwright's Hollow, wet stones at the two ponds).
- **Gameplay objects stay readable.** Nothing is placed within 2.5 units of a resource node, a station, a shrine or a camp member's home, and nothing in Cinderstep Pass's corridor (woods trees keep the larger clearances of 6.11). A harvestable tree must never be confused with a decorative one: backdrop trees stand only where the hero cannot go, and woods trees stand at least 4.5 units from every harvestable tree; both use a darker, less saturated crown and a taller, narrower silhouette than any harvestable tree, and neither offers a click action.
- **Density by tier changes count, never rules.** A lower tier thins every cluster by the same fraction. Woods trees are not thinned on any tier: they are walkability (6.11).

### 5.7 Water, sky, weather

- **Water is a faceted sheet.** Colour by depth: bank (sand showing through), shallow (teal), deep (the existing `PALETTE.water`). A foam band where depth is under 0.12. Facets flash the key colour when their normal mirrors the sun. Toward the horizon the sheet takes the sky's colour. The river's ripples run along its course; pond ripples are rings.
- **The sky is drawn, not simulated.** A three-stop gradient from the table in 5.3, a sun disc with one halo step, a moon disc, stars as hard points that only appear when the key is the moon. Clouds are cut solids that drift with the wind and are lit by the key.
- **One wind.** Grass sway, cloud drift, cloud shadows on the ground, rain slant and particle drift all read the same wind vector and gust field. A gust front crossing a meadow is seen in the grass and as a moving shadow.
- **Weather is a mood per region, never a rule.** Clear, overcast, mist, rain (valley, plaza, woods), sand haze (dunes), ash fall (volcanic). Each is a set of offsets on the key intensity, the fog density and the particle mix. Rain is thin hard slivers, not streak textures. Nothing flashes: there is no lightning.

### 5.8 Effects in the idiom

- A particle is a small flat shape: a shard, a diamond, a leaf, a flake. No soft dot, no smoke puff texture.
- Glow comes from emissive colour plus bloom, not from stacked transparent spheres.
- Round effect geometry gets cut: spheres become icosahedra, 16- and 32-segment rings become 6 to 10 segments, tubes get 5 sides.
- Colour follows meaning and stays inside the interface's semantic colours (7.2): damage ember, heal moss, prayer tide, magic amethyst, loot brass.
- Timing, size and count are untouched. That is Stage 4.

### 5.9 The interface's identity, in one paragraph

The interface is cut from the same stone as the world: **dark slate panels with chamfered corners, a thin brass line, bone-coloured text, no glass, no blur, no gradient**. Shapes are polygons: panels and buttons have cut corners, the minimap is an octagon, vitals bars are split into two flat tones like a facet. One display face with cut, angular strokes carries titles and big numbers; one humanist text face with tabular figures carries everything else. Section 7 gives the system.

---

## 6. Rendering design

Module map (new files; each imports in `node`, has no import-time side effect, and stays under 1000 lines):

| Module | Holds | Layer |
|---|---|---|
| `src/data/look.ts` | The time-of-day keys, region palettes and air tints, weather offsets, flora rules per region, the tier table | data (pure) |
| `src/data/woodsTrees.ts` | `WOODS_TREES`: the committed table of woods-tree walk cells (integer pairs), and its clearance constants (6.11) | data (pure) |
| `src/state/collision.ts` (Stage 2, changed) | `isWalkableGround` (today's `isWalkable`, renamed and exported); `isWalkable` = ground and not a woods-tree cell (6.11) | state (pure) |
| `scripts/place-woods-trees.ts` | The one-off seeded placement that writes `woodsTrees.ts`; never imported by the game | tooling |
| `src/state/dayCycle.ts` | `dayFrameAt(phase)` (OKLab interpolation of the keys), sun and moon direction, phase from and to the saved preset, the clock step | state (pure) |
| `src/state/shadowFit.ts` | `fitShadow(camera position, camera forward, light direction, range, map size)`: frustum centre and texel-snapped light position; `stepShadowDir`: the stepped shadow direction (6.2) | state (pure) |
| `src/state/weather.ts` | `weatherAt(dayIndex, phase, regionWeights)`: deterministic schedule | state (pure) |
| `src/state/scatter.ts` | `buildScatter(seed, tier)`: instance lists from the flora rules and the Stage 2 world tables | state (pure) |
| `src/state/waterGrid.ts` | Cells, depth and flow for the water sheet, from `getTerrainHeight` | state (pure) |
| `src/engine/lighting.ts` | The light rig, shadow fitting, the point-light pool | engine |
| `src/engine/atmosphere.ts` | Shared uniform objects and the GLSL fog and wind text, `attachAtmosphere(material)` | engine |
| `src/engine/sky.ts` | Sky dome, sun, moon, stars, cloud solids, horizon apron | engine |
| `src/engine/water.ts` | Water sheet and shader | engine |
| `src/engine/batching.ts` | `mergeByMaterial(group)` | engine |
| `src/engine/floraKit.ts`, `flora.ts` | Procedural kit geometries; the ground field texture, the carpet, scatter instancing | engine |
| `src/engine/particles.ts` | Ambient motes and weather particles | engine |
| `src/engine/post.ts` | Composer per tier, pixel budget, tier governor, shader-error fallback | engine |
| `src/engine/photo.ts` | The debug hooks for fixed poses (8.2) | engine |

`buildSkyDomeShader`, `cycleTimeOfDay`, the water block and the grass block leave `worldMesh.ts`. `G.grassInstanced`, `G.waterUniforms` and `G.skyUniforms` (`context.ts` 186-188) are replaced by the new modules' own state.

### 6.1 The light model (G5.1)

`facetMaterial` keeps its signature, its `MeshLambertMaterial` base, the albedo map handling and the `metalness`/`roughness` filter (`tests/textures.test.ts` 81-92 stays green). It gains one parameter, `shade: 'cut' | 'round'` (default `round`, so every existing caller keeps smooth normals until its loader opts in). What changes inside `onBeforeCompile`:

- The replacement of `outgoingLight` (159-163) is deleted. Lambert's own sum is used again.
- `#include <lights_lambert_pars_fragment>` is replaced by a copy in which `RE_Direct_Lambert` computes `band(dotNL) * directLight.color * material.diffuseColor` (no division by pi: light intensities in 5.3 are authored for this) and `RE_IndirectDiffuse_Lambert` is `irradiance * material.diffuseColor`. `band` is the three-step or two-step function of 5.2, chosen by a `#define`. Every shader variant (cut or round, cloud shadows, simple water, plain mode) is set through `material.defines`, never through text chosen in a closure: three keys a program by `onBeforeCompile.toString()` plus `material.defines` (`Material.js` 109-113, `WebGLPrograms.js` 391-410), so two variants with the same hook source and the same defines would share one program. A tier change updates the defines and sets `needsUpdate` on the materials it affects. Because three multiplies the shadow into `directLight.color` before calling `RE_Direct` (`lights_fragment_begin.glsl.js` 145), shadows and every light type work with no further change.
- `shade: 'cut'` sets `flatShading: true` (three computes the face normal from screen derivatives, `normal_fragment_begin.glsl.js` 4-8). The terrain's 70% blend (5.1) is a third variant, `#define FACET_BLEND`: it keeps `flatShading` **off**, because with `FLAT_SHADED` three does not declare `vNormal` (`normal_pars_fragment`), and computes `normalize(mix(normal, faceNormal, uFacet))` with `faceNormal = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)))` right after `normal_fragment_begin`.
- **Program cache key.** `attachAtmosphere` and `terrainMaterial` chain `onBeforeCompile`; a wrapper has the same source text for every material it wraps, so three's default key (`onBeforeCompile.toString()`) would no longer tell the terrain from a plain facet material, and `acquireProgram` would hand one the other's program (`WebGLRenderer.js` 1669-1689). Every patched material therefore sets `customProgramCacheKey` to a string joined from constant tags of its chain, for example `facet|cut|air` or `facet|blend|terrain|air`. A test asserts the terrain, a cut facet, a round facet and the carpet have four different keys.
- The foot gradient (5.2) multiplies `diffuseColor` by a factor of object-space height, passed as a varying; `uFootHeight` of 0 turns it off (terrain, figures).
- The fog chunk is replaced by the atmosphere function (6.3).

Who opts into `cut`: `applyWorldMaterials` (`blenderWorld.ts` 47-118), the procedural builders in `worldBuild.ts` and `spawns.ts`, the bridge. `terrainMaterial` takes the blend variant instead. `spawnWorldProp` (`worldBuild.ts` 580-603) now calls `applyWorldMaterials` too, so its 13 props stop being the only `MeshStandardMaterial` surfaces in the world. The hero, guards, monsters and gear do not opt in.

The light rig (`lighting.ts`) replaces the three lights of `init3DEngine`: one `DirectionalLight` (key), one `HemisphereLight` (fill over bounce), one `AmbientLight` kept at a small constant so nothing reaches zero. Each frame it applies `dayFrameAt(phase)` plus the weather offsets. `toneMappingExposure` follows the table. The sun-follow lines in `updateCamera` (`loop.ts` 502-504) move into it.

The grass and water shaders stop carrying their own light direction; they read the shared uniforms of `atmosphere.ts`.

### 6.2 Shadows (G5.2)

- **Fitted**: the shadow frustum is a square of side `2 * range`, centred `0.35 * range` ahead of the camera along its forward direction projected on the ground, instead of on the hero. Range per tier: 40, 54, 70 (section 10).
- **Snapped**: the light position is rounded to the map's texel size in light space (`fitShadow`), so a walking hero does not make every edge crawl. Today the light follows the hero unsnapped every frame.
- **Stepped sun**: snapping does not help when the light direction itself turns, which rotates the map's texel grid and makes every edge swim. As games with a day cycle do, the shadow light's direction moves only when the true sun is more than 0.5 degrees away from it (about every 2 s at the running clock of CALL-V3); the shading key follows the true sun.
- **Biased**: `bias` plus `normalBias` (the terrain now casts on itself at low sun), both tuned at the light checkpoint.
- **Faded**: the shadow term fades to 1 between 80% and 100% of the range. Implementation: a wrapper function declared after `shadowmap_pars_fragment` and a `#define getShadow` that points three's call at it. If that proves fragile, the fallback is no fade and the larger range.
- **Type**: `PCFShadowMap` instead of `PCFSoftShadowMap`, for the hard edge of 5.1; it is also cheaper.
- **Casters**: merged props, vegetation of the understorey and canopy layers, figures, and now the terrain (`castShadow` true, so the ridge shadows the ground). The carpet, particles, clouds and water do not cast. Cloud shadows are a noise term on the key (6.4), not shadow-map casters.
- **Resolution by tier** (CALL-V5, replaces the foundation design's CALL-3): off, 2048, 2048, 4096. A tier change disposes the old map (`light.shadow.map.dispose()` and `map = null`), which is what finding 13 found missing.
- **Counted**: the perf HUD sets `renderer.info.autoReset = false` and resets once per frame, so shadow-pass calls are in the number for the first time. Section 10's budgets are written for that number.

### 6.3 Atmosphere (G5.4)

`atmosphere.ts` owns shared uniform objects (`uSunDir`, `uKeyColor`, `uAirColor`, `uAirSunColor`, `uFogDensity`, `uFogHeightFalloff`, `uFogBase`, `uWind`, `uTime`, `uRegionTint`) and one GLSL function, `applyAir(color, worldPos)`: exponential-squared distance fog multiplied by a height term, coloured by `mix(uAirColor, uAirSunColor, pow(max(dot(viewDir, uSunDir), 0), 8))`. `attachAtmosphere(material)` chains `onBeforeCompile`, points the program's uniforms at the shared objects (the same `{ value }` object in every program, so one write per frame updates all), and replaces the fog chunks. With every extra uniform at zero the function equals exponential-squared fog, so a material that misses the hook degrades to plain fog.

**One colour space for the air.** Three applies `fog_fragment` after `tonemapping_fragment` and `colorspace_fragment` (`meshlambert.glsl.js` 111-115), and when it renders into a render target (the composer path) it turns tone mapping off and writes linear values. Fog placed where three puts it would therefore be mixed in sRGB on the direct path and in linear light on the composer path, and differently again in the custom shaders. Rule: `applyAir` always runs on **linear radiance, before tone mapping**, in every shader. In the facet shader it is inserted before `#include <opaque_fragment>` and `fog_fragment` is removed; in the custom shaders it runs before `COLOR_FOOTER`. Every `AIR` colour uniform holds linear values (`Color.setHex` already converts). Then the direct path tone maps in the shader and the composer path in `OutputPass`, on the same numbers.

`scene.fog` stays a `FogExp2` whose colour and density follow the day frame; `MeshBasicMaterial` effects (`glowMaterial`, `vfx.ts` 34-42) keep using it unchanged.

The sky, water, grass, cloud and particle shaders include `applyAir` and end with three's `tonemapping_fragment` and `colorspace_fragment`, which fixes fact 4 of section 1 and makes the direct path and the composer path agree.

### 6.4 Sky, clouds, horizon (G5.3, G5.8)

- **Dome**: one `ShaderMaterial`, the three-stop gradient, a sun-side horizon glow, sun and moon discs as steps, stars from a hash of the view direction, drawn only when the moon is the key; `dithering: true` (three's own `dithering_fragment`) against banding. One draw call, as today. The dome follows the camera, radius 440, so neither the hero nor the far plane reaches it (today's dome is fixed at the origin with radius 290, `worldMesh.ts` 40, and its far side is clipped by `far` 360 when the camera stands near a corner).
- **Clouds**: about 24 instances of three jittered-icosahedron clusters from `floraKit.ts`, in one or three `InstancedMesh` draws, at 60 to 90 units up, drifting with the wind (their 24 instance matrices are updated on the CPU each frame, which is trivial), wrapped inside the terrain square, lit by the facet shader, fogged by `applyAir`. Balanced tier and up.
- **Cloud shadows**: two octaves of value noise on world XZ plus wind, multiplied into the key inside the facet shader. No texture. High tier and up.
- **Horizon apron**: one mesh of about 600 to 800 triangles. Its inner boundary is the terrain's own square edge (plus or minus 130), sharing the edge heights so there is no gap and no seam; from there it rises into two rows of low jittered hills out to radius 240, air-coloured silhouettes. A ring around the origin cannot work: the walkable square reaches plus or minus 118 (`collision.ts` 47), so the terrain's corners (radius 184) would cut through a ring starting at 150, and a void would show between the terrain edge at 130 and the ring along each side. It closes every view at the camera's live limits (pitch down to 0.12, distance up to 26, `input.ts` 114 and 125).
- **Far plane**: the camera can stand about 118 times root 2 plus 26, roughly 193 units, from the centre, so the apron's far side can be about 433 units away. Camera `far` rises from 360 (`renderer.ts` 111) to 460, a constant in `look.ts`; near stays 0.5, a depth ratio of 920, well inside a 24-bit depth buffer.

### 6.5 Water (G5.5)

`waterGrid.ts` walks a 1-unit grid and keeps the cells where the terrain is below the water plane (-0.34, `worldMesh.ts` 166) plus a one-cell margin: the river strip and the two Stage 2 basins. Per vertex it stores depth (water plane minus terrain height) and a flow direction (the river's tangent from `riverCenterX`, zero in ponds). About 5,000 cells, 10,000 triangles (estimate; today's sheet is 1,152 triangles over the whole map, most of it under the ground). One draw call, as today.

The shader: two travelling sines displace vertices by a few centimetres; the face normal comes from derivatives; colour is a three-stop ramp over depth; a foam band where depth is under 0.12, broken by the sines; the banded sun flash of 5.7; a Fresnel mix toward the sky's horizon and zenith colours (uniforms, no reflection pass); alpha from depth so the bank shows through. Performance tier: depth ramp and foam only. The water does not receive shadows (a `ShaderMaterial` without three's shadow chunks); the ridge's shadow stops at the bank. Accepted: adding the shadow chunks to a transparent sheet is not worth its complexity.

### 6.6 Batching (pays for 6.7)

`mergeByMaterial(group)` merges the meshes of a cloned prop that share a material into one geometry per material (`applyWorldMaterials` makes a new material object per mesh, so "share" means the same colour, albedo id, emissive, shade and side), with `mergeGeometries` from `three/examples/jsm/utils/BufferGeometryUtils.js`, after `applyWorldMaterials` and before `sealAlbedoUvs` and `addCartoonOutline`. `mergeGeometries` refuses a mix of indexed and non-indexed inputs, so non-indexed inputs are indexed (or all converted) first. It is called from `cloneWorldNode` (so resource nodes, stations and landmarks all get it) and from `spawnWorldProp`. Node names, pivots, scales and material names in the GLB are untouched; the lookups by `World_<name>` and by material name happen before the merge.

Expected effect, from the GLB's own structure: a normal tree 13 meshes to 2, an oak 18 to 2, the castle 68 to 5, the bridge 41 to 3, an ore rock 9 to 2, the shrine 20 to 4. The swap between live and depleted meshes (`upgradeResourceNodeWithGltf`, `blenderWorld.ts` 147-235) works on the groups and is unaffected. Raycasts get fewer, larger targets.

Riding on this change:

- **Finding 23**: `assignProjectedUvs` tracks finished geometries in a `WeakSet` instead of `geometry.userData.albedoUv` (`textures.ts` 262 and 312). Merged geometries are new objects, so every instance gets projected UVs. This changes how most props are textured, which is why it was deferred to this stage; it is judged at the ground slice's checkpoint.
- **Finding 29**: `loadAlbedo` (`textures.ts` 124-141) caches one base texture per id and returns a clone per repeat, which shares the image source. It is fixed here because the same function gains anisotropic filtering (16 at most, clamped to the device, by tier).
- **Outline shells stay as they are.** A hidden shell per mesh (`materials.ts` 78-107) is created eagerly, and three frozen tests read it right after `addCartoonOutline` (`tests/textures.test.ts` 114-118, `tests/dispose.test.ts` 58, `src/__tests__/lean-rig.test.ts` 65). Merging already cuts the number of shells with the number of meshes; building them lazily is not worth a test replacement.

### 6.7 Vegetation (G5.6)

**The ground field.** At startup `flora.ts` samples the pure world functions into one 257 x 257 half-float RGBA `DataTexture` over the 260-unit terrain: R height, G carpet density (0 on paths, pads, water, steep slopes, region cores' paved parts; raised on path verges), B variant selector, A region blend. About 66,000 calls of `getTerrainHeight` once at load (the Stage 2 budget already allows 25,921 for the mesh and 55,696 for the walk grid).

**The carpet.** A fixed number of tuft instances lies on a jittered grid that wraps around the hero. The vertex shader derives each tuft's world cell from its instance index and the hero's position, reads height and density from the ground field, scales the tuft to zero where density is zero or at the carpet's edge, and bends it with the shared wind. No per-frame CPU work, no popping. The carpet's material is `facetMaterial` (round, two bands, `vertexColors` for the root-to-tip tint) with one extra vertex patch on `begin_vertex` for placement and wind, not a separate `ShaderMaterial`: that way it receives the shadow map, the banded light and `applyAir` through the same code as the ground. A custom shader would leave tufts bright inside a tree's shadow, the most common grass-shadow defect. Its instances are placed in the shader, so their instance matrices are identity and `InstancedMesh`'s bounding sphere would sit at the origin: `frustumCulled = false`. Three or four variant geometries (meadow tuft, flower, dry tussock, ember grass) are three or four draws. Tufts per tier: 0, 6,000, 14,000, 24,000 at about 8 triangles each.

**The scatter.** `buildScatter(seed, tier)` is pure and deterministic (a seeded generator, not `Math.random`). It reads the flora rules in `look.ts` and the Stage 2 tables (`PATHS`, `RIDGES`, `BASINS`, `POIS`, `CAMPS`, safe zones, the walk grid, node placements) and returns instance lists per kit piece, applying every rule of 5.6. Inside each cluster, members are spaced by Poisson-disk sampling (Bridson's method, minimum distance from the larger piece's radius), as placement tools do, so no two pieces interpenetrate and spacing never looks gridded. `flora.ts` turns each list into one `InstancedMesh` (one draw per kit piece, about 14 pieces). About 700 understorey and 500 canopy and crag instances at full density (starting numbers, tuned at the checkpoint). The scatter reads walkability through `isWalkableGround` and `isWalkable`, so no understorey piece lands on a woods-tree cell; it never produces woods trees.

**Woods trees.** `flora.ts` also draws one instance per row of `WOODS_TREES` (6.11), on every tier, as two `InstancedMesh` variants (two draws plus their shadow draws). They cast shadows wherever the tier has them and are never added to `G.worldInteractiveObjects`.

**The kit.** `floraKit.ts` builds each piece once from seeded, jittered primitives with vertex colours: 3 boulders, 2 bushes, fern, reed clump, log, snag, sapling, 2 backdrop trees, 2 woods trees, 2 crags, mushroom cluster, 3 cloud clusters. No model file.

Models: **none is essential.** Optional, and only if the owner asks after seeing the ground slice (CALL-V8): a Blender-authored set of four crag pieces and two backdrop trees in a new `flora.glb` (about 60 to 90 kB on the wire, estimate), loaded through `loadGltfOnce`, leaving the five existing GLBs untouched.

### 6.8 Weather, particles, local light (G5.7)

- **Schedule**: `weatherAt` is a pure function of the day index, the phase and the region weights at the hero's position, so a pose and a phase always give the same weather. Each state is a row of offsets in `look.ts`.
- **Motes**: one `InstancedMesh` of small flat shapes in a box that follows the camera. Position, spin and fade are computed in the vertex shader from a per-instance seed and `uTime`. The mix depends on region and phase: pollen and leaves (valley), dust (plaza, dunes), fireflies (woods at night, emissive), embers and ash (volcanic). Count per tier: 0, 150, 400, 800.
- **Rain, haze, ash fall**: a second instanced set of slivers and flakes, same mechanism, slanted by the wind. Count per tier: 0, 600, 1,500, 3,000. Both sets are placed in the shader, so both have `frustumCulled = false`.
- **Local light**: a fixed pool of point lights (0, 0, 2, 4 by tier) is assigned every 0.25 s to the nearest emissive props (lanterns, forge, lava fissures, shrine crystals) when the key is weak. The pool size changes only when the tier changes, which recompiles the lit programs once (a short hitch, at a moment the player chose or the governor announced); assigning lights to emitters never does. They pass through the same banded response.
- **Reduced motion**: when the browser reports `prefers-reduced-motion`, camera shake is off, weather particles are halved and wind amplitude is a third.

### 6.9 Effects (G5.7)

`vfx.ts` keeps every function, parameter, lifetime and tick. A table in the plan swaps geometry constructors (sphere to icosahedron, segment counts down) and routes colours through the semantic set of 7.2. If Stage 4 has rewritten an effect, its timing wins and only its shapes and colours are touched. Hit splats and XP drops are DOM (`vfx.ts` 13-28) and belong to the interface (7.3).

### 6.10 Output, resolution, fallback (G5.9, G5.12, G5.13)

- **Two paths.** Performance and balanced tiers render straight to the canvas with the canvas's own antialiasing, as today. High and ultra render through the composer: a multisampled half-float target, `UnrealBloomPass` at half resolution, and three's stock `OutputPass` (tone mapping and colour space from the renderer's settings). No vignette and no custom output shader; banding in the sky is handled by the sky material's `dithering`. Because the picture's colour comes from the lights and the air, and the air is applied before tone mapping in every shader (6.3), both paths show the same game.
- **Bloom threshold.** Without the division by pi, a noon key of 2.0 on an albedo of 0.75 (about 0.52 linear) already gives about 1.0 before fill and bounce, roughly 1.3 with them, and `UnrealBloomPass` thresholds linear, pre-exposure values. So `BLOOM.threshold` in `look.ts` is set at least 15% above the brightest lit surface under any key (computed by `litGroundValue` at albedo 0.75, full band), and every emitter and every effect core colour sits at least 20% above the threshold. A look-data test holds both rules, so only emissive things glow.
- **Two multisampled buffers.** Antialiasing of the canvas is fixed when the context is created, so on the composer tiers the canvas keeps its multisampled buffer beside the composer's own. The megapixel caps below bound both; above 8.3 megapixels the composer target drops to 2 samples.
- **Pixel budget.** The effective pixel ratio is the tier's cap (`getQualityDpr`, `renderer.ts` 15-23, unchanged: 1.0, 1.25, 1.5, 2.0) further limited by a maximum pixel count per tier (3.7, 6.0, 8.3, 16.6 megapixels), so a 4K display at ratio 2 does not allocate a 33-megapixel half-float target. Above 8.3 megapixels the composer target drops to 2 samples.
- **Capability fallback.** If the device cannot render to a half-float target, the composer uses an 8-bit target. If hardware acceleration is off (`initGpuTelemetry`, `renderer.ts` 73-104 already detects it), the game starts on the performance tier.
- **Governor.** After a tier is applied, if the median frame time over 4 s is above 24 ms, the game steps down one tier, once per step, and says so in the chat. It never steps up by itself. A window in which the page was hidden is ignored (animation frames stop or slow there). Once the player picks a tier with the button, the governor is off for the rest of the session: a 30 Hz panel or a laptop on battery must not undo the player's choice every 4 seconds.
- **Measuring.** The perf HUD's frame time is the interval between animation frames (`loop.ts` 676-679), which vsync rounds to the display's period: two tiers that both finish under 16.7 ms read the same. Frame-time budgets (section 10) are therefore measured with `__DEBUG.look.bench(frames)`, which renders the current view back to back and waits once with `gl.finish()`, giving milliseconds per frame free of vsync. It is a debug hook only.
- **Shader failure.** `renderer.debug.onShaderError` (called from `WebGLProgram.js` 936) switches to **plain mode**: composer off, carpet, particles, clouds and water effects off, one chat line. Three stops logging the shader error itself once the handler is set (`WebGLProgram.js` 936-938), so the handler logs it first. Programs already compiled keep their cache key, so a flag read by `facetMaterial` would only reach new materials: every patched material registers in one list, and `enterPlainMode` swaps each for a stock `MeshLambertMaterial` with the same colour, map, emissive and side. The world stays visible and playable. A URL flag forces plain mode for testing.

### 6.11 Woods trees that block walking (CALL-V9, decided 2026-11-14)

The owner decided that trees in the woods block walking. The lead had recommended the opposite, so this is a deliberate game-rule change, the only one in the stage. This section is its design. It is built against Stage 2 as found on `wp/W` and `feat/world-place` at the time of writing. R0 re-checks every premise below and stops the stage if one fails.

**How walking works today (Stage 2).** `isWalkable(x, z)` (`collision.ts`) is the single predicate: walk bound ±118, deep river, castle walls, Harrowback Ridge core, basin water. Every mover goes through it:
- the walk grid `buildWalkGrid` (`pathfind.ts`) samples it once at the centre of each 1-unit cell (236 × 236 = 55,696 cells) and is built once in `init3DEngine`;
- A* runs on 8 neighbours with no corner cutting, then smooths the route by testing segments against the continuous predicate every 0.25 units;
- click-to-move, the minimap click and "Walk here" reject an unwalkable point with "You cannot walk there.". The click ray tests `G.worldInteractiveObjects` (the terrain, nodes, stations, monsters), so a mesh outside that list never takes a click;
- the hover does **not** read walkability: `updateHoverTile` raycasts the terrain mesh only and highlights the 1-unit cell under the cursor, walkable or not, as it does over water today;
- the hero's step and every monster's step go through `moveWithCollision`, which tries the full move, then x only, then z only;
- monsters do **not** path-find: `stepMonster` walks straight at the player, or at its wander point;
- `sanitizePose` (`save.ts`) moves a saved position that is unwalkable to the nearest walkable point, on rings of 0.5 to 12 units.

**What blocks.**
- **The woods trees this stage adds**: tall trunks with crowns, in the `woods` region only (`regionAt(x, z)?.id === 'woods'`, as the fern rule uses). The target is about 150 trees. The tests allow 100 to 220, and GR7 tunes the number within that range.
- **Harvestable trees stay as they are and do not block.** They are Stage 2 placements with approach rules (stop distances, `entityGoal`), and frozen Stage 2 tests require their surroundings to be reachable. Blocking them would change how woodcutting is approached, which is a skilling rule and outside this decision. They are told apart from woods trees by look and spacing (5.6).
- **Nothing else changes.** POI pieces, crates, barrels, stations, rocks, bushes, logs, reeds and the canopy on unwalkable ground stay non-blocking. A frozen Stage 2 test requires every POI piece to stand on walkable ground.

**Collision shape: one whole walk cell.** A tree's centre is always a cell centre (`-118 + i + 0.5`), and the tree blocks exactly that 1 × 1 cell: a point is blocked when `floor(x + 118)` and `floor(z + 118)` name a tree cell.
- The drawn trunk has a radius of 0.30 to 0.42, so it sits inside its cell. The hero stops at the cell edge, 0.5 from the trunk's centre, about where its body meets the bark.
- The shape is a cell, not a circle, so that the walk grid and the continuous predicate agree exactly. A cell is blocked on the grid if and only if every point in it is blocked. A circle of radius under 0.5 can miss every cell centre. A* would then route through a trunk that the hero's step then refuses, and the hero would stall.
- One more reason: games in this tradition block whole tiles for trees, so a tree costs exactly one tile of walking.

**How trees enter walkability.**
- `collision.ts` renames today's predicate to `isWalkableGround` and exports it.
- `isWalkable(x, z)` becomes `isWalkableGround(x, z) && !isWoodsTreeCell(x, z)`.
- `isWoodsTreeCell` reads a 236 × 236 bitmap. It is built from `WOODS_TREES` on the first call, so nothing runs at import time (rule K9).
- The extra cost per call is one array read, with no change to any signature.
- The walk grid, the A* smoothing, every click check, the hero's and the monsters' `moveWithCollision`, and `sanitizePose` all see the trees with no edit to their files. The hover tile is unchanged. Over a tree it highlights the tree's own cell, because the hover tile and the walk cell are the same 1-unit grid, and that cell is exactly what the tree blocks.
- `pathfind.ts`, `monsterAi.ts`, `save.ts`, `input.ts` and `loop.ts` are not touched. The grid keeps its 55,696 cells, and its build does one more array read per cell.

**Placement rules.** These keep the world playable. Every rule is a test (8.1).
Cell distance below means the Chebyshev distance `max(|di|, |dj|)` between cell indices.
- **Spacing.** Any two tree cells are at cell distance ≥ 3. That leaves at least two free cells between any two trunks, in a line or diagonally, so a 2-unit lane always remains.
- **Away from existing obstacles.** Every tree cell is at cell distance ≥ 3 from every cell whose centre has `isWalkableGround` false: river, ponds, ridge core, castle, walk bound.
- **Why that is enough.** With no corner cutting, a 1-cell obstacle with no other obstacle within 2 cells cannot close any passage or enclose any cell. The set of cells reachable from the start is therefore exactly the old set minus the tree cells. The reachability test proves this rather than assuming it.
- **Clearances.** The distance is measured from the tree cell's centre:
  - paths: at least the path's `halfWidth` + 3 from its centre line (the bare strip, the 2-unit verge and half a cell);
  - resource nodes (fishing spots included), stations and shrines: at least 4.5 (the largest stop distance, 3.5, plus a cell's half-diagonal), so every side of every target stays open;
  - POIs: at least `padRadius` + 3 from the centre;
  - camps: none inside any camp's radius + 2. Each camp is a clearing, which covers its centre, every member's home, wander circle and respawn point;
  - safe zones: none inside any of them;
  - Cinderstep Pass: none inside its corridor;
  - saves: none on the cell of the start point, the Stage 1 save fixture's position or any of the 20 old spawn points the Stage 2 relocation test lists.
- **Woods only.** Every tree stands where `regionAt` is `woods` and `isWalkableGround` is true.
- **What this leaves treeless.** The woods region is a circle of radius 45 around (-75, -30). The moss guardians' camp has centre about (-75.5, -30.5) and radius 22, so the camp-plus-2 rule clears a central glade of radius 24, about 28% of the region's area. The woods shrine, the end of Lanternway and the woods safe zone stand inside that glade. Of the yew and magic trees placed on `wp/W`, four are inside the glade and three are in the ring, where each keeps its 4.5-unit clearance. The blocking forest is therefore the ring between radius 24 and 45, minus Lanternway's lanes, Lampwright's Hollow, Reedglass Tarn and the region's overlap with `lumbridge`. That ring is about 4,500 square units, comfortably above what about 150 trees at cell distance 3 need. The glade is the price of CALL-V21 option A. A smaller clearance (each member's home plus its wander radius plus 2) would put trees inside the camp and let fights there snag.

**Determinism.** Walkability is game state that tests and saves depend on, so the trees are a committed table, not generated at run time.
- `src/data/woodsTrees.ts` holds `WOODS_TREES: readonly (readonly [number, number])[]`: integer cell indices `[i, j]`, sorted, no duplicates. Integers give the same cells in every browser, with no floating-point borderline.
- The table is written once by `scripts/place-woods-trees.ts`. That script is a seeded Poisson-disk placement under the rules above. It is bundled and run with the `esbuild` that vite already installs (`npx esbuild scripts/place-woods-trees.ts --bundle --platform=node --format=esm --outfile=<scratch>/place.mjs && node <scratch>/place.mjs`), so no dependency is added. Its seed is in the script's header, and the game never imports it.
- Rerunning the script is a declared `tune` commit, allowed only until the ground checkpoint (CP-GR). After CP-GR accepts, the table is frozen; any later change is a game-rule change and needs the owner.
- If Stage 2 data later moves a path or a camp across a tree, the placement tests fail loudly. They never pass silently.

**A saved position inside a trunk.** The existing rule handles it with no new code. `sanitizePose` finds an unwalkable saved point and moves it to the nearest walkable point on its first ring (0.5 units). A tree cell's four neighbours are always free, so the move is at most about 1 unit. A test checks every tree cell. The save format and its keys do not change (section 9).

**What the player will notice.**
- The woods are a ring of dense forest around an open central glade (the guardians' camp and the shrine).
- Clicked routes in the woods bend around trunks.
- Keyboard movement stops against a trunk head-on and slides along it at an angle.
- Clicking exactly on a trunk's cell answers "You cannot walk there.", as water does. A click on a trunk's crown or bark hits the ground behind it, because woods trees are not click targets.
- **Monsters snag.** They walk straight at the player, so a trunk directly between a monster and the hero, on a nearly axis-aligned line, stops the monster: it slides only along the free axis, and that slide is tiny when the line is nearly straight. The player can then use a tree as cover. This is the "safespot" of old-school games.
- Camps are clearings, so fights that start in a camp never meet a trunk. Snags happen only when a chase leaves the camp toward trees.
- Moss guardians, the woods camp, are the monsters affected. This is owner decision CALL-V21.

**Every tier.** Walkability cannot depend on the graphics level, so every woods tree is drawn on every tier, performance included. Tier density thins the understorey, the canopy on unwalkable ground and the carpet, never these trees (section 10).

**Cost.**
- Walking: one array read per `isWalkable` call, and a 56 kB bitmap built once.
- Drawing: about 150 instances of at most 80 triangles each (about 12k triangles) in two draws, plus two shadow draws on tiers with shadows.
- Bytes: the table is about 2 kB of JS.
- Edits to Stage 2: `collision.ts` only. Its frozen tests (reachability, relief, world data, pathfinding, save relocation, world budget) stay green untouched.

**Goals this weakens, said plainly.**
- The essence's "no game rule changes" (section 1, CALL-V1) no longer holds. It now carries this one exception.
- "A harvestable tree must never be confused with a decorative one" (5.6) is weaker: woods trees now stand where the hero walks, near harvestable trees. It rests on look and spacing alone: a 4.5-unit gap, a darker and narrower crown, and no click action.
- No goal is made impossible.

---

## 7. Interface design

### 7.1 Type system (CALL-V11)

Two families, self-hosted woff2, `font-display: swap`, with a system stack behind each so the interface is complete before and without them.

| Role | Used for | Requirements |
|---|---|---|
| Display | Region banner, level-up and death titles, modal titles, the hero's name, large numbers (hit splats, XP drops) | Cut, angular strokes that echo the facets; legible at 16 px; at least two weights; SIL OFL 1.1 or equivalent |
| Text | Everything else | Humanist sans, legible at 11 px on a dark ground, tabular figures, weights 400 and 600 (700 optional), SIL OFL 1.1 or equivalent |

The lead's candidates are **Grenze** for display and **Alegreya Sans** for text. Both are believed to be under the SIL Open Font License, but that was not checked for this document: the first interface task downloads each family from its publisher's repository at a pinned commit, reads the licence file, records title, author, source, commit and SHA-256 in `CREDITS.md`, and ships the licence text beside the fonts. Acceptance criteria for any family: a licence that allows redistribution and embedding; no Reserved Font Name clause that forbids a subset under the same name (otherwise ship unsubsetted or rename the subset); tabular figures in the text face; a Basic Latin plus Latin-1 subset; all files together at most 120 kB. If a candidate fails, the task proposes another against the same criteria and the owner picks.

Scale (rem, root 16 px times the interface scale): 11, 12, 14, 16, 20, 28, 40. Nothing is smaller than 11 (today there are 8, 9 and 10 px texts). Weights 400, 600, 700 only (today 800 and 900 are used for emphasis; the display face replaces that). All numbers use tabular figures. Labels over the world get a 1 px ink outline instead of a glow.

**Interface scale.** The root font size is `16px * clamp(1, min(viewport width / 1440, viewport height / 810), 2)`, and component sizes are in rem. A 4K display at ratio 1 then shows the same layout as 1080p instead of a postage stamp. The existing breakpoint at 800 px (`styles.css` 1823) stays.

### 7.2 Colour (CALL-V12)

New tokens, semantic names, prefix `--ui-`. Every `--osrs-*`, `--botw-*` and `--panel-*` token (`styles.css` 2-15) is renamed away, and the inline colours in `index.html` move to classes.

| Token | Value (starting point) | Role |
|---|---|---|
| `--ui-ink` | `#0e1116` | Deepest ground, outlines, hard shadows |
| `--ui-slate-1`, `-2`, `-3` | `#151a21`, `#1d242d`, `#2a3440` | Panel, raised surface, line |
| `--ui-bone`, `--ui-bone-dim` | `#ece4d2`, `#b9b09c` | Text, secondary text |
| `--ui-brass`, `--ui-brass-hi` | `#c9a24a`, `#e6c877` | Accent, focus, selected, currency, loot |
| `--ui-ember` | `#d4553a` | Hitpoints, damage, danger |
| `--ui-moss` | `#6fae5a` | Success, heal, special energy |
| `--ui-tide` | `#5b9bd0` | Prayer |
| `--ui-amethyst` | `#a98ae0` | Magic |
| `--ui-warn` | `#e0b040` | Warnings, yellow threat |

Rule: every text and surface pair in use meets WCAG AA (4.5 to 1; 3 to 1 for text of 20 px and up). A test computes the ratios from the token values, so finding 30 cannot come back. Values may move to pass it. Panels are 94% opaque, flat colour: all six `backdrop-filter` rules (`styles.css` 326, 382, 504, 880, 923, 1618) go, which also removes a full-screen blur over the canvas from every frame.

### 7.3 Component language

| Component | Language |
|---|---|
| Panel | Slate-1, 6 px chamfered corners, a 1 px slate-3 line and a 1 px lighter top edge ("the cut edge catches the light"), one hard 2 px ink shadow, no glow |
| Button | 3 px chamfer. Three kinds: primary (brass line, brass text), plain (slate-3 line), danger (ember line). Pressed moves down 1 px. Disabled drops to bone-dim, never below AA |
| Tab | A button without a bottom line; the selected tab joins its panel and carries a brass top edge |
| Slot | The inventory stays 4 by 7. Slate-2 square with a 3 px chamfer; quantity bottom-right in tabular figures with ink outline; selected is a brass line; an empty equipment slot's label uses bone-dim (finding 30) |
| Vitals bar | A flat fill split into two tones along its length like a facet; value in tabular figures; no rounded caps, no gradient |
| Minimap | An octagon instead of a circle; brass line; the canvas backing store is sized by the device pixel ratio so it is sharp (today 198 by 198 CSS and device pixels, `index.html` 168) |
| Modal | A panel with a display-face title, `role="dialog"`, `aria-modal`, `aria-labelledby`; focus moves in on open and returns on close; Escape closes |
| Tooltip, context menu | Slate-2, 3 px chamfer, text face 12; the menu's items are buttons |
| Banner and toast | Display face on a wide, low panel; the region banner sets the region name large and its subtitle in spaced small capitals |
| Hit splat, XP drop | Display-face numerals, semantic colour, ink outline, no pill |
| Focus | A 2 px brass outline with a 2 px offset on `:focus-visible`, on every control |
| Motion | 120 ms for state, 240 ms for panels, ease-out. Under `prefers-reduced-motion` every animation and transition is off and no animation loops |

Chamfers use `clip-path` polygons on two layers (line colour outside, surface inset by 1 px), which costs nothing at run time.

### 7.4 Accessibility and the audit findings

- **30** (contrast): the token contrast test, plus the slot label and locked shrine title use bone-dim; the `opacity: 0.72` on locked cards goes.
- **31** (click-only divs): the combat style options, special attack, perf HUD, compass and inventory slots become `<button type="button">` with the same classes and an `aria-label`; icon-only tab and close buttons get labels. A test scans `index.html` for an element other than a button, anchor or input that carries a click handler.
- **32** (dialogs, motion): the modal row of 7.3 and the motion rule. The focus move and return live in `openModal` and `closeModals` (`playerActions.ts`).
- **24** (station modals lose scroll and focus): `renderBankModal` and `renderShopModal` (`stations.ts` 180, 241) save the `scrollTop` of `#bank-grid`, `#bank-pack` and `#shop-pack`, and whether `#bank-search` is focused with its caret, before they assign `innerHTML`, and restore them after. This is the audit's minimal fix. The render functions are not rewritten (4.6).

### 7.5 Inline handlers and the script policy (CALL-V13)

The foundation design left a `script-src` policy "for Stage 5", because it needs the 38 inline `onclick` attributes of `index.html` gone first (its section 9, finding 5, and R1). A scan for any `on<event>=` attribute and any `<script` finds exactly these 38 in `index.html`, none under `src/`, and one script tag, the external module at `index.html` 406; so the 38 are all of them. Proposal: do it here, as the last interface task, since this stage edits that markup anyway. Each `onclick="name(args)"` becomes `data-action="name"` with `data-arg` attributes; one delegated listener in `wireBridge` looks the name up in the existing `WINDOW_GLOBALS` list and calls it. Then `vercel.json` sends `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'`. `style-src` keeps `'unsafe-inline'` because `stations.ts` writes style attributes inside `innerHTML`.

This needs two more declared test replacements (8.3). If the owner declines, the 38 handlers stay on their new buttons and the policy is deferred again to Stage 7 in writing; nothing else in this stage depends on it.

---

## 8. Verification

### 8.1 Goals and proofs

Headless, in vitest (`node`):

| Goal | Proof |
|---|---|
| G5.1 | New `tests/facet-light.test.ts`: the compiled fragment text of `facetMaterial` contains the banded `RE_Direct_Lambert`, keeps `#include <map_fragment>`, and contains Lambert's own `outgoingLight` sum (the old replacement is gone); `shade: 'cut'` sets `flatShading`; the terrain's blend variant does not set it and declares `uFacet`; `terrainMaterial` still samples the eight ground maps; the terrain, a cut facet, a round facet and the carpet have four different `customProgramCacheKey` values; `fog_fragment` is gone and `applyAir` comes before `tonemapping_fragment`. The two declared replacements of 8.3. |
| G5.2 | `tests/shadow-fit.test.ts`: the snapped light position is a whole multiple of the texel size on both light-space axes; moving the camera by less than one texel does not move it; the frustum contains the hero at every camera yaw; range and map size come from the tier table; the shadow direction does not move while the true sun stays within 0.5 degrees of it, and snaps to it beyond. |
| G5.3 | `tests/day-cycle.test.ts`: `dayFrameAt` returns each key exactly at its phase; it is continuous across phase 1 to 0 and between keys (no channel jumps more than 0.02 per 0.001 of phase); sun elevation never exceeds 62 degrees; near phase 0.58 the sun is within 5 degrees of (0.52, 0.78, 0.34); `presetToPhase` and `phaseToPreset` round-trip 0, 1 and 2; every phase maps to 0, 1 or 2. The existing save tests stay green, and `serializeState`'s keys are unchanged. |
| G5.4 | `tests/look-data.test.ts`: fog density by height is monotonic; every key, region and weather row is complete; under every key the computed lit-ground value (key times band plus fill, on the meadow albedo) is at least 22%; `BLOOM.threshold` is at least 1.15 times the brightest lit value over all keys, and every emitter colour at least 1.2 times the threshold. Shader text contains `applyAir` in the facet, sky, water, carpet and particle shaders. |
| G5.5 | `tests/water-grid.test.ts`: every water cell has terrain below the water plane within one cell; depth at the river centre and at each basin centre is positive; flow is a unit vector on the river and zero in ponds; the cell count is under 6,000. |
| G5.6 | `tests/scatter.test.ts`: same seed, same output; no instance within a path's half-width, a POI pad, 2.5 units of a node, station, shrine or camp home, or in the pass corridor; every canopy and crag instance is at a point where `isWalkableGround` is false (it is false beyond 118, which the walk grid does not cover) and not in water; no understorey instance lies within 1 unit of a woods-tree cell's centre; reeds are within 3 units of water; ferns are only in `woods`; no two understorey or canopy instances are closer than the larger piece's radius; every region and every POI has instances; counts per tier are inside the tier table. New `tests/woods-trees.test.ts` (6.11), written before the trees exist:<br>• **The table:** `WOODS_TREES` holds integer cells, sorted, with no duplicates; it has 100 to 220 rows.<br>• **Placement:** every tree is in `woods` on walkable ground; every two trees are at cell distance `max(|di|, |dj|)` ≥ 3; every tree is at cell distance ≥ 3 from every cell where `isWalkableGround` is false; no tree breaks any clearance of 6.11 (paths, nodes, fishing spots, stations, shrines, POIs, camps plus 2, safe zones, the pass corridor, the start point, the save fixture and the 20 old spawn points); no tree cell is on a path sampled each unit.<br>• **Walkability and reach:** `isWalkable` is false at every point of every tree cell (centre and four inset corners) and equals `isWalkableGround` everywhere else on a 0.25 sampling of the woods. The cells reachable from the start with the trees equal the cells reachable without them, minus the tree cells. Every shrine, station, POI centre, camp member's home, resource node and fishing spot has a reachable walkable cell within its stop distance, and `findPath` from the start returns a route to it.<br>• **Saves and the walk grid:** `sanitizePose` moves a position at every tree cell's centre to a walkable point within 1.1 units. `buildWalkGrid()` still has 55,696 cells and blocks exactly `WOODS_TREES.length` more cells than `buildWalkGrid(isWalkableGround)`; its build time, as a median of 5, is at most 1.5 times the ground-only build in the same run.<br>• **Determinism:** a text scan of `woodsTrees.ts` finds only literals and no function call, so the table is the same on every load. |
| G5.7 | `tests/weather.test.ts`: same day index, phase and region give the same state; every state is allowed in its region; particle counts come from the tier table. `tests/vfx-shape.test.ts`: no `SphereGeometry` remains in `vfx.ts`, and no lifetime or tick constant differs from a recorded list. |
| G5.8 | In `scatter.test.ts`: the border ring between 118 and 130 has canopy or crag instances in each of 16 sectors. In `look-data.test.ts`: the largest distance from any camera position (walk bound 118 on both axes, camera distance 26) to the apron's outer edge is below `CAMERA_FAR`; the dome radius is below `CAMERA_FAR`; the apron's inner edge equals the terrain's half-size. |
| G5.9 | `tests/gfx-tiers.test.ts`: the pixel budget never returns more than the tier's megapixels, nor more than the tier's ratio cap. `tests/ui-tokens.test.ts`: no font size below 11 px in the CSS; the minimap canvas is sized from the device pixel ratio. |
| G5.10 | `tests/ui-tokens.test.ts`: no `--osrs-`, `--botw-` or `--panel-` in `styles.css`, `index.html` or `src/`; no `backdrop-filter`; every `@font-face` URL is relative; no `http://` or `https://` URL in the CSS. `tests/ui-fonts.test.ts`: the font files exist, total at most 120,000 bytes, a licence file sits beside them, and `CREDITS.md` has a row per family with licence and source. New names and tokens pass the Stage 2 deny-list. |
| G5.11 | `tests/ui-a11y.test.ts` (text scan): no click handler on a non-interactive element in `index.html`; every `.modal-window` has `role="dialog"`, `aria-modal` and `aria-labelledby`; the CSS has a `prefers-reduced-motion` rule that turns animation and transition off. `tests/ui-tokens.test.ts`: every text and surface token pair in a declared list is at least 4.5 to 1. A pure helper test for the scroll and focus snapshot of finding 24. |
| G5.12 | `tests/gfx-tiers.test.ts`: the tier table matches section 10 (shadow size, range, carpet, particles, point lights); the governor steps down once after a slow window and never up. BUILD reports the chunk size. |
| G5.13 | `tests/plain-mode.test.ts`: the shader-error handler sets plain mode once, and plain-mode `facetMaterial` contains no custom chunk. |
| G5.14 | Finding 23: two clones of one geometry both get projected UVs. Finding 29: two repeats of one id share one image source. Findings 24, 30, 31, 32: the rows above. |

Needs a person looking at the running game: 8.2.

### 8.2 Fixed poses and what the owner should see

`photo.ts` adds to the existing `window.__DEBUG` (`runtime.ts` 190): `look.pose(row)`, `look.phase(p)` (freezes the clock), `look.weather(name)`, `look.hud(on)`, `look.tier(id)` (applies a tier and turns the governor off for the session, so a software-rendered capture can still show the balanced and high tiers) and `look.bench(frames)` (6.10). A pose is a row in `docs/superpowers/baseline/stage5/poses.json`: a place (a POI id or region id from the Stage 2 tables, never a raw coordinate), yaw, pitch and distance inside the game's live camera limits (pitch 0.12 to 1.15 rad, distance 3.6 to 26, `input.ts` 114 and 125), a phase and a weather. The capture run seeds `Math.random` before the game boots (a script injected by the browser driver, no game change), dismisses the onboarding window, waits for the models, and saves each pose with the HUD off and, for P11, on. "Before" pictures are taken on `main` after Stage 4, at the same poses, with the hooks only.

| Pose | Place and view | Times | What the owner should see after the stage |
|---|---|---|---|
| P1 | Start town, the view of `shot-03-noon.jpg`, east toward Three Kettle Camp | noon, golden, night | Noon: every tree, the stall and the hero cast a shadow; grass is green in light and blue-green in shade, not black spikes. Golden: long shadows, warm faces, violet shade. Night: blue ground still readable, the camp's fire and lanterns glow. |
| P2 | Millrace Road at the bridge, looking up the river | dawn, noon | Dawn: mist lying on the water, warm horizon upstream. Noon: bank, shallows and deep water in three colours, a foam line at the bank, facets flashing. |
| P3 | Wardstone Cairn, looking at Cinderstep Pass | golden | Harrowback Ridge throws its shadow across the ground toward the camera; its crest is above the haze; the pass is a bright notch. |
| P4 | Inside Cinderstep Pass, looking through | night | Lava seams and embers are the only warm light; the sentries are round figures against cut rock. |
| P5 | The last shrine, the view of `shot-04-peak.jpg` | noon, night | Ash in the air, a grey-violet distance, obsidian that shows planes; at night the shrine crystals light the ground (high tier). |
| P6 | Reedglass Tarn | dawn, rain | Reeds only at the water; the sky's colour in the far water; in rain, slivers slanting with the wind and a darker, flatter light. |
| P7 | Tamarisk Pool | noon, golden with haze | Hard short shadows on pale sand, violet shade, the one pink accent; in haze the dunes become three flat layers. |
| P8 | Lampwright's Hollow | noon, night | Noon: a dense, blue-green wood with a light floor of ferns, tall trunks standing in the walkable wood, and clear lanes along Lanternway and around the hollow. Night: lanterns pool amber light, mushrooms glow, fireflies. |
| P9 | The east plaza | noon, overcast | Cut stone with weeds in the joints; overcast flattens the key but shadows stay. |
| P10 | Three Kettle Camp, eight yaws 45 degrees apart, lowest pitch (0.12), maximum distance (26); plus the same eight yaws from the walkable corner nearest the camp | noon | In all eight frames: a foreground, a middle and a far plane; a closed horizon; no map edge, no void, no straight line where the world ends. |
| P11 | The HUD with the inventory open; bank, shop, world map, quests and settings windows; level-up banner; a hit splat | 1280 by 720, 1920 by 1080 and 3840 by 2160 at ratio 1; 1920 by 1080 at ratio 2 | The new type and panels; nothing smaller than the 11 px step; the same layout at 4K as at 1080p; a sharp minimap; a visible focus ring when tabbing. |
| P12 | P1 while walking 30 units | noon | Shadow edges do not crawl; the carpet does not pop; the tier governor stays quiet. |

Also by a person: the perf HUD at P1, P3, P5 and P8 on every tier against section 10, on the owner's GPU; keyboard-only use of a bank visit (finding 31, 32); scrolling the bank grid, withdrawing, and seeing the scroll stay (24); forcing plain mode by its URL flag; in the woods, click-to-move routes around trunks, keyboard movement slides along them, and a moss guardian that chases the hero out of its camp behaves as CALL-V21 decides when a trunk stands between them (6.11); the browser console on a preview deployment showing no CSP violation (if CALL-V13 is taken).

### 8.3 Declared test replacements

Declared here so they are not mistaken for weakening:

1. `tests/textures.test.ts`, "cel-shades the sampled diffuse color and leaves the ink outline alone" (94-119): the three assertions at 107-111 (the fixed tint line, the fixed `smoothstep`, and "does not contain the Lambert sum") are replaced by: contains the banded `RE_Direct_Lambert`, and contains the Lambert sum. The outline assertions stay.
2. Same file, "blends grass, dirt, sand, and stone in the terrain cel shader": the one assertion at 262 (the fixed tint line) is replaced by the banded-function assertion. Every map and uniform assertion stays.

Only if CALL-V13 is taken:

3. `tests/globals.test.ts`: "finds onclick calls in index.html" becomes "index.html has no inline handler attribute", and the second test checks `data-action` names against `WINDOW_GLOBALS`.
4. `tests/vercel-headers.test.ts`: the exact-string check of the policy becomes "the policy contains `frame-ancestors 'self'`, `script-src 'self'`, `object-src 'none'`, and no `unsafe-inline` or `unsafe-eval` in `script-src`".

Every other existing test stays as it is, including the 256-pixel tile tests: tile resolution does not change (CALL-V7).

---

## 9. Save format impact

| | Stage 5 |
|---|---|
| Key, `version` | unchanged |
| Fields written | unchanged. `timeOfDay` is still 0, 1 or 2: the preset nearest to the clock's phase (0 golden hour, 1 noon, 2 night; dawn maps to 0) |
| Reading | unchanged. On load the clock starts at the saved preset's phase (0.70, 0.50, 0.00). A saved position on a woods-tree cell is moved by the existing `sanitizePose` rule to the nearest walkable point, at most about 1 unit away (6.11) |
| New persistent keys | none. The graphics tier is not saved, as today |
| Rollback | A save written after Stage 5 loads in the build before it and shows that build's three presets |

The Settings button keeps its three labels and jumps the clock to the next preset. Between presses the clock runs: a full day is 24 minutes, with the phase moving twice as fast while the sun is down, so about 18 minutes of day and 6 of night (CALL-V3, decided 2026-11-14: the running clock). Weather, wind and the scatter seed are not saved.

---

## 10. Performance budget and quality tiers

No frame time on a real GPU has ever been recorded for this game: the baseline is from a software renderer (3 to 4 FPS), and the owner's FPS is still open from Stage 1. So frame costs below are estimates for a mid-range discrete GPU at 1920 by 1080, and the binding numbers are relative to a capture taken on `main` after Stage 4 (plan task V2). Draw calls are counted **with the shadow pass** from this stage on (6.2), which the foundation design's section 8 numbers did not include.

### Tier table (CALL-V5)

Every visual feature of this design has a row; a feature not in this table does not exist. The button shows these four tiers as **Low, Medium, High, Ultra** (CALL-V18, decided 2026-11-14). The internal ids stay `performance`, `balanced`, `high` and `ultra`, and the columns below use the ids.

| Feature | performance (Low) | balanced (Medium, default) | high (High) | ultra (Ultra) |
|---|---|---|---|---|
| Pixel ratio cap; megapixel cap | 1.0; 3.7 | 1.25; 6.0 | 1.5; 8.3 | 2.0; 16.6 |
| Canvas antialiasing (fixed at context creation) | on | on | on | on |
| Path | direct | direct | composer, bloom | composer, bloom |
| Composer target samples | none | none | 4 | 4 (2 above 8.3 MP) |
| Banded light, three sources, day cycle | yes | yes | yes | yes |
| Shadows: size, range | off | 2048, 40 | 2048, 54 | 4096, 70 |
| Shadow fade at range end | off | yes | yes | yes |
| Terrain casts, cloud shadows | no, no | yes, no | yes, yes | yes, yes |
| Foot gradient on props and flora | yes | yes | yes | yes |
| Air: distance fog | yes | yes | yes | yes |
| Air: height term, sun lean, region tint | no | yes | yes | yes |
| Sky: gradient, sun and moon discs | yes | yes | yes | yes |
| Sky: stars, horizon glow | no | yes | yes | yes |
| Horizon apron | yes | yes | yes | yes |
| Anisotropy | 1 | 4 | 8 | 16 |
| Carpet tufts | 0 | 6,000 | 14,000 | 24,000 |
| Scatter density | 50% | 75% | 100% | 100% |
| Woods trees that block walking (6.11) | all | all | all | all |
| Clouds | no | yes | yes | yes |
| Motes; weather particles | 0; 0 | 150; 600 | 400; 1,500 | 800; 3,000 |
| Point lights | 0 | 0 | 2 | 4 |
| Water | ramp and foam | full | full | full |
| Ink outline | player's toggle, off by default | same | same | same |
| Effects in the idiom (6.9) | yes | yes | yes, glowing | yes, glowing |
| Governor | steps down from any tier until the player picks one by hand (6.10) | | | |

Why performance is truly cheap: no shadow pass at all (today's game draws one even where it is never seen), no carpet, no particles, no clouds, no composer, half the scatter, simple water, plain distance fog, and merged props (6.6) that cut the colour pass's calls well below today's. The one thing it cannot thin is the woods trees (about 12k triangles in two draws), because they are walkability, not decoration (6.11). Its per-pixel work is one Lambert evaluation with a band step and one fog term: about what today's facet shader already pays. The only cost it cannot drop is the canvas's antialiasing, which WebGL fixes when the context is created; turning it off would need a reload and a stored setting, which this stage does not add.

Software rendering starts on performance. The governor (6.10) steps down on slow frames.

### Budgets, replacing the foundation design's section 8 for this stage (CALL-V6)

These budgets are provisional until plan step OV-2. There the baseline is benched on the owner's computer, which the owner names at that first timing as the reference machine (QV5). The lead then adjusts the numbers below and the tier numbers once, to what was measured, and freezes them (CALL-V20, decided 2026-11-14).

| Measure | After Stage 2 (its budget) | After Stage 5, balanced tier | Reason |
|---|---|---|---|
| Draw calls, start pose, colour pass | at most 1750 | at most 60% of the V2 capture, and at most 1000 | Merging removes more calls than the sky, clouds, kit and particles add (about 25). |
| Draw calls, start pose, with shadow pass | not counted | at most 60% of the V2 capture | Same merging, and the range drops from 54 to 40 on this tier. |
| Triangles, start pose | at most 300k | at most 550k (high 750k, ultra 950k) | Instanced vegetation is triangles without calls. The old limit was set when every triangle cost a share of a call. |
| Frame time on the owner's GPU, same pose, measured with `look.bench` (6.10), not the vsync-bound HUD | not lower than baseline by more than 5% | balanced: within 10% of the V2 bench; high: at most 16.6 ms if V2's balanced bench was at most 12 ms; ultra: at most 33 ms | The balanced tier is the same-cost tier; the upper tiers are where the new work is spent. |
| JS chunk | 951 kB cap | at most the V2 chunk plus 80 kB (about 25 kB gzipped, estimate) | Composer and bloom about 14, lighting, air and sky 14, water 4, flora, kit and scatter 16, particles and weather 8, look data and day cycle 6, batching 5, interface code 8, woods-tree table and walk check 3, slack 2. All estimates; BUILD reports the real number per slice. |
| CSS | 29.3 kB | at most 45 kB | Component language and the reduced-motion and focus rules. |
| Fonts | 0 | at most 120 kB, cached immutable under `/assets` | Two families, subset. |
| Models on the wire | 3.76 MB | 3.76 MB | None added (CALL-V8). |
| Textures | unchanged | unchanged | Noise is computed. Finding 29 halves duplicate uploads. |
| Startup work added | | about 66,000 height samples (ground field), one scatter build, one merge per prop | Once, before the first frame or in idle slices after it. |
| GPU geometries after 200 attacks and 20 gear swaps | returns to the start value | same | The effect restyle keeps `disposeObject3D`. |

### Cost per slice (estimates)

| Slice | Frame cost, balanced | Draw calls | Bytes |
|---|---|---|---|
| 1 Light and sky | about +0.3 ms (the shadow pass is paid today; the banded light replaces a cheaper constant; terrain joins the shadow pass) | +1 (terrain in the shadow pass) | JS about +14 kB |
| 2 Air and output | direct path about +0.3 ms; composer tiers about +1.5 to 2.5 ms | +3 to +5 (ring, clouds), plus about 12 full-screen draws on composer tiers | JS about +19 kB |
| 3 Water | about -0.2 to +0.3 ms (fewer pixels, richer shader) | 0 | JS about +4 kB |
| 4 Ground | merging about -1 to -3 ms of CPU submission; carpet and scatter about +1 to 2 ms; woods trees about +0.1 ms on every tier (one array read per walk check, about 12k triangles) | about -40 to -55% from merging, then +20 (4 carpet, 14 kit, 2 woods trees) and their shadow draws | JS about +24 kB (table about 2 kB, walk check under 1 kB) |
| 5 Weather and local light | about +0.3 to 0.6 ms; point lights only on high and ultra | +2 | JS about +8 kB |
| 6 Interface | negative: six backdrop blurs removed | 0 | fonts up to 120 kB, CSS up to +16 kB, JS about +8 kB |
| 7 Effects in idiom | slightly negative (fewer triangles per effect) | 0 | about 0 |

---

## 11. Audit ledger for this stage

| # | Finding | Came from | Decision in Stage 5 | How |
|---|---|---|---|---|
| 23 | Projected-UV flag shared by geometry clones | deferred to Stage 5 | **Fixed** | `WeakSet` in `assignProjectedUvs` (6.6); judged at the ground checkpoint. |
| 24 | Station modals lose scroll and focus on refresh | deferred to Stage 5 | **Fixed** | Scroll and focus snapshot around the `innerHTML` assignment (7.4). The render functions are not rewritten. |
| 30 | Contrast below AA | deferred to Stage 5 | **Fixed** | Tokens and a contrast test (7.2, 7.4). |
| 31 | Click-only divs | deferred to Stage 5 | **Fixed** | Buttons with labels and a markup test (7.4). |
| 32 | Modals without dialog semantics; motion ignores the preference | deferred to Stage 5 | **Fixed** | Dialog attributes, focus handling, reduced-motion rule (7.3, 7.4, 6.8). |
| 29 | Texture cache keyed by repeat | deferred to Stage 7 | **Fixed here** | Stage 5 edits `loadAlbedo` for anisotropy, so it fixes the cache in the same change (6.6). |
| 5 (the `script-src` part) | A script policy "waits for Stage 5" | foundation design section 9 and R1 | **Fixed if CALL-V13 is taken, otherwise deferred again to Stage 7** | 7.5. The reason for a second deferral would be: removing 38 handlers is a markup change the owner prefers to make with the touch-control work. |
| 27 | 11.9 MB of uncompressed GLBs | deferred to Stage 7 (shelved) | **Not touched; stays with Stage 7** | Stage 5 changes no GLB. The shelved compression design's note that position and UV quantisation "comes with finding 23 in Stage 5" is declined in writing: the fix for 23 does not need it, and UVs stay Float32. |
| 13 | Tiers and shadow resolution (fixed in Stage 1 by CALL-3) | fixed | **Reopened on purpose** | CALL-V5 gives tiers their own shadow size again, with the map disposed on change. |

---

## 12. Threat model

### 12.1 What are we working on?

A single-player browser game served as static files. Stage 5 adds no server, no network call from game code and no parsed input. What it does add:

| Flow | Source | Trust | Sink |
|---|---|---|---|
| Shader text | String constants in `src/engine`, composed from fixed parts and `#define`s from the tier table | Ours, reviewed in git | The GPU driver's GLSL compiler |
| Look data | `src/data/look.ts`, the Stage 2 world tables | Ours, compiled constants | Light rig, scatter, weather, uniforms |
| Fonts | Two woff2 families, downloaded once by a developer, committed | Third party, pinned by commit and hash | The browser's font parser |
| three's example modules | Files inside the installed `three` package | Third party, already trusted and locked by `package-lock.json` | The bundle |
| Debug hooks | `window.__DEBUG.look` | The player, in their own console | Camera, clock, weather (not the save) |
| Markup and policy | `index.html`, `vercel.json` | Ours | DOM, response headers |
| Device | GPU capabilities, `devicePixelRatio`, window size, `prefers-reduced-motion` | Untrusted in range: can be huge, tiny or missing | Render target sizes, tier choice |

Trust boundaries: the developer machine and CI (fonts enter the repository there), the device (capabilities and sizes), and the response headers. The save boundary is not moved: no new field is read or written.

### 12.2 What can go wrong?

| # | Failure |
|---|---|
| V1 | A shader fails to compile or link on some driver, and the screen is black. |
| V2 | A value from outside reaches shader text or a uniform unchecked: a string concatenated into GLSL, a `NaN` in a light or fog uniform, a saved value used as a define. |
| V3 | A huge window or pixel ratio allocates render targets or a shadow map beyond GPU memory; the context is lost. |
| V4 | Counts grow without bound: particles, instances, lights, per-frame allocations. Frame time or memory creeps. |
| V5 | A font is not licensed for redistribution, or the licence forbids the subset; a font file is tampered with between download and commit; a font is fetched from a third-party host at run time and leaks the player's address. |
| V6 | The stricter policy (CALL-V13) blocks something the game needs (the favicon data URL, textures, a model fetch), and the deployed game breaks while local runs pass. |
| V7 | The interface restyle introduces a new `innerHTML` sink fed by a save-derived string. |
| V8 | Decoration hides or blocks something the player must reach or click: a node, a station, the pass. Woods trees, which block on purpose, seal off an area, narrow a passage to nothing, strand a saved position, or differ between two loads or two tiers. |
| V9 | Light or weather makes the game unplayable for some players: a night too dark to read, flashing, motion that cannot be turned off. |
| V10 | The look changes without anyone deciding it: a merge or a UV fix shifts textures, a three patch release changes a chunk the facet shader edits. |
| V11 | The frozen tests are weakened under cover of the declared replacements. |
| V12 | The capture run or the debug hooks change game state: a pose teleport autosaves a position, a frozen clock is saved. |
| V13 | A new name, token or look turns out to be taken from an existing game. |

### 12.3 What are we going to do about it?

| Risk | Decision |
|---|---|
| V1 | Mitigate: plain mode on `onShaderError` (6.10), with a test of the handler and a URL flag to force it. Accept the remainder: a driver that miscompiles silently is found only by eye. |
| V2 | Eliminate: shader text is built only from constants and from the tier table's closed set of defines; no string from the save, the DOM or the URL is ever concatenated into it (the plain-mode flag is read as a boolean). Day frames and weather are computed by pure functions whose outputs are tested finite and in range; that is the boundary, and the engine trusts it. |
| V3 | Mitigate: the megapixel cap per tier (6.10); the 4096 map only on ultra and only if `maxTextureSize` allows; the 8-bit fallback target. |
| V4 | Mitigate: every count is a constant in the tier table, with a test; the particle and carpet systems allocate once and animate in the vertex shader; the point-light pool has a fixed size. The Stage 1 leak check is repeated at the gate. |
| V5 | Mitigate: fonts come from the publisher's repository at a pinned commit; licence read by the task and shipped beside the files; SHA-256 recorded in `CREDITS.md`; self-hosted under `/assets`; a test forbids any absolute URL in the CSS. |
| V6 | Mitigate: the policy is listed in full in 7.5 and checked by a test for its required parts; a person opens a preview deployment and reads the console before the merge. It is the last interface task, so it can be reverted alone. |
| V7 | Mitigate: new interface code builds DOM with `textContent` and elements; the finding-24 fix adds no sink. The verify step of each interface task greps for new `innerHTML` assignments. |
| V8 | Mitigate: `scatter.test.ts` is the boundary check for generated decoration (clear radii, the pass corridor, canopy only on ground-unwalkable cells). Decoration is never added to `G.worldInteractiveObjects`, so it cannot take a click. For the woods trees, `woods-trees.test.ts` is the boundary check (6.11). It proves that the reachable set equals the old one minus the tree cells, that every target keeps a reachable cell within its stop distance, that each clearance holds and that `sanitizePose` frees every tree cell. The table is a committed literal, so it cannot differ between loads, and it is read by walkability only, never by the tier. The frozen Stage 2 tests stay green untouched. |
| V9 | Mitigate: the 22% night floor is a test on the look data; there is no lightning or strobe; `prefers-reduced-motion` is honoured in CSS and in the engine; the Settings button still jumps to noon. |
| V10 | Mitigate: before and after pictures at fixed poses for every slice, shown to the owner; `facet-light.test.ts` fails if three's chunk text no longer contains what the facet shader replaces, so an upgrade of three cannot change the look silently. |
| V11 | Mitigate: 8.3 names each replaced assertion by test title and line; the gate reads `git diff main -- tests` and accepts edits only there. |
| V12 | Accept, with reason: the hooks move the hero and the clock exactly as play does, so the autosave writes a valid position and a valid preset. The capture run uses a throwaway browser profile. |
| V13 | Mitigate: new tokens, class prefixes and any new label go through the Stage 2 deny-list test; the font names are their publishers' own. Accept the remainder: no test proves originality of a look; the owner's checkpoint per slice is the check. |

### 12.4 Did we do a good enough job?

By the proofs in 8.1 and the pictures in 8.2. In particular: for shaders, the text tests, plain mode, and the per-slice poses on every tier; for generated decoration, the scatter test; for fonts, the file, licence and credits test; for the policy, the header test and the preview console; for the frozen tests, the diff check at the gate. If the banded light cannot be written as a replacement of `lights_lambert_pars_fragment` as described, the design is wrong at 6.1 and the stage stops there, before any other slice.

---

## 13. CALLs for the owner to check

| # | Proposal | Lead's recommendation | Where |
|---|---|---|---|
| CALL-V1 | The essence of the look: flat planes, painted tiles, limited palette, hard edges; no save change in this stage, and no game-rule change except the blocking woods trees the owner chose (CALL-V9, 6.11). | Accept. | 1 |
| CALL-V2 | "Cut world, round figures": terrain, props, vegetation and water are shaded per plane; the hero, guards, monsters and gear stay smooth with two bands. | Accept. The alternative, everything cut, makes faces and dense monster meshes noisy. | 5.1 |
| CALL-V3 | A running day clock: 24 minutes per day, about 18 of day and 6 of night; the Settings button jumps between the three existing presets; the save still stores 0, 1 or 2. | Accept. The alternative is three richer fixed presets with no clock: less alive, same cost. **Decided 2026-11-14: the running clock** (24 minutes, about 18 of day and 6 of night). | 5.3, 9 |
| CALL-V4 | Night is blue and readable (a floor of 22% on lit ground). No rule depends on time or weather. | Accept. | 5.3 |
| CALL-V5 | The tier table, one row per visual feature, including shadow size and range per tier (this replaces CALL-3's "2048 on every tier"), the megapixel caps and the automatic step-down on slow frames, which stops once the player picks a tier by hand. | Accept. | 10, 6.10 |
| CALL-V6 | New budgets: draw calls go down to 60% of the measured number, triangles may rise to 550k on the default tier, JS may grow by 80 kB, fonts by 120 kB, CSS to 45 kB. Frame times are benched without vsync. All provisional until OV-2 (CALL-V20). | Accept. The old triangle limit protected draw calls, and merging now does that directly. | 10 |
| CALL-V7 | Texture tiles stay 256 pixels. "Old school 8k" is delivered by edges, shadows, facets, anisotropic filtering and resolution, not by larger tiles. | Accept. Tiles at 512 would add roughly 1 MB of PNG for a look the painted tiles do not need. | 6.6, 8.3 |
| CALL-V8 | No new model: all new vegetation, rocks, crags and clouds are built in TypeScript. A Blender-made `flora.glb` (about 60 to 90 kB) only if the owner asks for it after seeing the ground slice. | Accept "none now". | 4.5, 6.7 |
| CALL-V9 | Decoration never blocks movement, and tall decoration stands only on ground the hero cannot walk on. Inside the woods the forest is ferns, saplings, logs and the existing harvestable trees, framed by tall trees outside the walkable area. | Accept. Tree trunks that block would change walkability, the path grid and how monsters chase: a rule change, out of scope. **Decided 2026-11-14, against the recommendation: woods trees block walking.** About 150 trees in the woods each block one walk cell, so routes and monster chases there bend around trunks. Every place stays reachable, and harvestable trees and all other decoration still do not block (6.11). | 5.6, 6.11 |
| CALL-V10 | Weather: clear, overcast, mist, rain, sand haze and ash fall, by region, on a deterministic schedule, cosmetic only, no lightning. | Accept. | 5.7, 6.8 |
| CALL-V11 | The type system: a cut display face and a humanist text face, self-hosted, at most 120 kB; candidates Grenze and Alegreya Sans, to be confirmed against their licence files by the first interface task; nothing smaller than 11 px; the interface scales with the window up to 2 times. | Accept the system; the families are confirmed or replaced by that task and shown to the owner. **Agreed 2026-11-14 (QV4):** the owner picks the two families when shown samples (plan UI1 report, OV-7). The type system itself is still open. | 7.1 |
| CALL-V12 | The interface's identity: slate panels with chamfered corners, a brass line, bone text, an octagonal minimap, faceted vitals bars, no blur and no gradient; tokens renamed from `--osrs-*` and `--botw-*` to `--ui-*`. | Accept. | 5.9, 7.2, 7.3 |
| CALL-V13 | Remove the 38 inline handlers and send a full Content-Security-Policy with `script-src 'self'` in this stage, with two more declared test replacements. | Accept: the markup is being edited anyway and the foundation design promised it here. Declining defers it to Stage 7. | 7.5, 8.3 |
| CALL-V14 | The two declared replacements in `tests/textures.test.ts` (three assertions and one assertion), which exist because the light model changes on purpose. | Accept. Without them the stage cannot start. | 8.3 |
| CALL-V15 | Effects are restyled in shape and colour only; no timing, size or count changes; Stage 4's version of any effect wins on timing. | Accept. | 5.8, 6.9 |
| CALL-V16 | Findings 23, 24, 30, 31, 32 are fixed here; finding 29 is pulled forward from Stage 7; finding 27 stays with Stage 7; the scenic second ridge is declined. | Accept. | 11, 3 |
| CALL-V17 | Bloom and the composer only on the high and ultra tiers; no ambient-occlusion, reflection or depth-of-field pass on any tier. | Accept. | 4.3, 6.10 |
| CALL-V18 | Tier names. Today the button cycles Performance, Balanced, High, Ultra. You asked for levels such as low, medium and high. Rename the four labels to Low, Medium, High, Ultra (internal ids and behaviour unchanged; the tier is not saved, so nothing breaks). | Rename. It is the wording you used, and players read it at a glance. **Decided 2026-11-14: rename** to Low, Medium, High, Ultra. | 10 |
| CALL-V19 | Texture crispness. The 256-pixel tiles are magnified smoothly today, which blurs up close at high resolution. Option: crisp texels up close (nearest magnification), still smooth at a distance (mipmaps). | Show both at the light checkpoint and pick there. Crisp texels are the "old school, but sharp" look many retro-modern games use, and the switch is one constant. **Decided 2026-11-14: smooth.** Magnification stays linear, as today. No comparison is captured and no texel-filter constant is added. | 5.1, CALL-V7 |
| CALL-V20 | Budgets after measuring. Once the baseline is benched on your computer (plan OV-2), keep the budgets of section 10 as written, or let the lead adjust them and the tier numbers once to what your GPU can do, then freeze them. | Let them be adjusted once, then frozen. They were written before any real measurement existed. **Decided 2026-11-14: yes**, adjusted once after the first timing on the owner's computer, then frozen. | 10 |
| CALL-V21 | Monsters and trunks (new, created by the CALL-V9 decision). Monsters walk straight at the player and do not path-find, so a trunk can stop a chasing monster and the player can use it as cover. Option A: accept this. Camps are trunk-free clearings, so it happens only when a chase leaves a camp. The price is a treeless central glade of radius 24 in the woods, about 28% of the region (6.11). Option B: give monster chase the walk grid (`findPath`, re-pathed as the hero's follow does), a Stage 2 rule change to `monsterAi.ts` and the engine's monster step. | A. Cover behind obstacles is part of the old-school tradition. It affects only the moss guardians in the woods, and only outside their clearing. B changes combat behaviour everywhere, which is Stage 4's ground. | 6.11 |

---

## 14. Risks

| # | Risk | Likelihood | What happens | Handling |
|---|---|---|---|---|
| X1 | Flat-shaded terrain flickers between bands on gentle ground, or shows a triangle grain. | Medium | The ground looks noisy at low sun. | The facet blend (`uFacet`) and alternating diagonals; tuned at the light checkpoint; at 0 the terrain is smooth as today. |
| X2 | The banded light through three's chunk text breaks on a three upgrade, or two variants share a cached program because a define was missed. | Low now, real later | Black or stock-lit materials. | The text test fails first; plain mode at run time; `three` stays on 0.169 until a task re-checks the chunks. |
| X3 | The shadow fade through `#define getShadow` does not compile on some driver. | Low | No fade. | Fallback named in 6.2: larger range, no fade. |
| X4 | No real frame time exists, so every cost here is a guess. | Certain | A slice costs more than estimated. | V2 benches the owner's GPU first (`look.bench`, free of vsync) and OV-2 confirms or adjusts the budgets before any slice starts; each slice's checkpoint benches again; the governor and the tier table absorb what remains. |
| X5 | Stages 2, 3 and 4 change the files this design cites. | Certain | Line numbers and some symbols are wrong at start. | Plan task R0 re-anchors every citation and stops if a premise of section 1 no longer holds. |
| X6 | Merging changes how props are textured (finding 23) and the owner prefers the old accident. | Medium | Props look different. | Judged at the ground checkpoint with before and after pictures; prop repeat (`PROP_REPEAT`) is the knob. |
| X7 | The vertex texture fetch for the carpet is slow on integrated GPUs. | Medium | The balanced tier misses its frame time. | Carpet count is a tier number; the governor steps down; performance has no carpet. |
| X8 | The chosen fonts fail a licence criterion or the size cap. | Medium | The interface task stalls. | The system stack is complete without them; the task proposes replacements against the same criteria. |
| X9 | The night floor and bloom fight: a readable night looks washed out. | Medium | Night loses mood. | Exposure and bloom threshold are per key; tuned at the light and air checkpoints. |
| X10 | `clip-path` chamfers clip focus rings or child shadows. | Medium | Focus is hard to see. | The focus ring is drawn by the inner layer, with an offset inside the panel; checked at P11 by tabbing. |
| X11 | Stage 4 rewrote `vfx.ts` and the swap table no longer matches. | Medium | The effects slice needs rework. | That slice is last, independent, and its task starts by re-reading `vfx.ts`. |
| X12 | The world looks "too new" and loses the old-school feel. | The owner's judgment | The stage misses its bar. | Each slice is shown on its own before the next starts; every slice can be held back without blocking the others, except that slice 1 comes first. |
| X13 | Woods trees change play: routes in the woods get longer, keyboard movement stops against trunks, and monsters snag on them (CALL-V21). | Certain (it is the decision) | The woods play slightly differently from today. | The clearances and the 2-cell lanes of 6.11; camps are clearings; P8 and G-6 have a person walk and fight in the woods; GR7 may lower the tree count within the tested range before CP-GR. |
| X14 | Stage 2 data moves after the table is written (a path, camp or node shifts), and a tree now breaks a clearance or sits on a saved position. | Medium until Stage 2 is merged, low after | A placement test fails. | R0 re-checks Stage 2; `woods-trees.test.ts` fails loudly; the table is regenerated by its script in a declared commit before CP-GR. After CP-GR any change goes to the owner. |
| X15 | A smoothed route grazes a trunk cell's corner between two 0.25-unit samples. | Low | The hero slides along the trunk for a frame. | The shape is a whole cell, and a non-axis move into a corner always has one free axis in `moveWithCollision`, so the hero slides and never stalls. Same behaviour as today's castle walls. |
| X16 | Crowns hide the hero at the lowest camera pitch. | Medium | The hero is lost under the canopy. | Crowns start at least 3.2 units up; at CP-GR the owner judges P8 at pitch 0.12; GR7 may thin trees near paths within the tested range. |

---

## 15. Open questions and what could not be verified

Questions whose answer changes what is built:

- **QV1.** CALL-V3: a running clock, or three fixed presets? **Decided 2026-11-14: the running clock.**
- **QV2.** CALL-V13: remove the inline handlers and send the full policy now, or with Stage 7? **Decided 2026-11-14: now.** The owner answered "ok" to doing it in this stage after the trade-off was explained. CALL-V13 is taken, so every "if CALL-V13 is taken" condition in this design and in the plan applies, including the two extra declared test replacements.
- **QV3.** CALL-V9: is a forest made of undergrowth plus a tall frame outside the walkable area enough for the woods, or do you want trees that block, accepting a change to walkability? **Decided 2026-11-14: trees that block** (6.11).
- **QV4.** CALL-V11: the two font candidates, once the first interface task shows them in the HUD. **Agreed 2026-11-14:** the owner picks them when shown samples (plan OV-7).
- **QV5.** Which GPU and display is the reference for "balanced must stay within 10%"? Without it, section 10's frame-time rows cannot be checked. **Agreed 2026-11-14:** the owner names the reference machine at the first timing (plan OV-2).
- **QV6.** CALL-V18: rename the tiers to Low, Medium, High, Ultra? **Decided 2026-11-14: yes.**
- **QV7.** CALL-V19: smooth or crisp texels up close? **Decided 2026-11-14: smooth.**
- **QV8.** CALL-V20: keep the budgets as written, or adjust them once after the baseline is measured on your computer? **Decided 2026-11-14: adjust once after the first timing, then freeze.**
- **QV9.** CALL-V21 (new): may a trunk stop a chasing monster (cover, as in old-school games), or should monster chase use the walk grid?

Not verified for this document:

- Any frame time, on any tier. There is no GPU measurement of the game at all.
- The share of the shadow pass in today's cost. It is known to be uncounted by the perf HUD (code reading), not how large it is.
- That the screenshots' missing shadows are caused by the discarded `reflectedLight`. The code says so and the pictures agree; no experiment was run.
- The draw-call reduction from merging. The mesh and material counts per prop are from the GLB; the percentage is an estimate.
- The minified and gzipped size of the three example modules and of the new code. Source sizes were measured; the rest is an estimate.
- The licences, glyph coverage, tabular figures and subset sizes of the two font candidates.
- That the facet shader's chunk replacement compiles, and that the `getShadow` wrapper compiles.
- Anything in Stages 2, 3 and 4 beyond the Stage 2 design and the first Stage 2 data commit on `feat/world-place`: final coordinates, the final shape of `worldMesh.ts`, what Stage 4 does to `vfx.ts`.
- How the proposed colours look. The hex values are directions, not results.
- The walking rules 6.11 builds on. They were read on the Stage 2 branches `wp/W` and `feat/world-place` (`collision.ts`, `pathfind.ts`, `monsterAi.ts`, `save.ts`, `worldMap.ts`, and the Stage 2 tests), before Stage 2's click-to-move task B3 was merged. Not verified: that `G.walkGrid` is still built once from `isWalkable`, that monsters still do not path-find, and the final stop distances. R0 checks all three.
- Corrected after review (`2026-11-14-visual-pass-critique.md`): the camera limits (live pitch 0.12 to 1.15, distance 3.6 to 26, not `sanitizeCam`'s 0.42 and 9.5), the shadows already visible on `spawnWorldProp`'s 13 PBR props, the horizon ring (now an apron, `far` 460), fog colour space, bloom threshold, program cache keys, carpet shadows and frame-time measurement.
