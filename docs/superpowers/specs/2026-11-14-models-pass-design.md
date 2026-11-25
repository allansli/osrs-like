# Models pass: design

> **Approved by the owner on 2026-11-14**, design and plan, after the critique and the second-pass check. Asked to approve with the recommended answer to N-5, the owner answered "Segue"; the main session reads that as approval and told the owner so. **N-5: the hero's bones sit at the original author's joints, in the hero's own slightly arms-out pose**; the third declared replacement in `src/__tests__/blender-hero.test.ts` (lines 58-59) is authorised with it. The stage lands after Stage 5; its first visible result is the pilot goblin, where the owner accepts or stops the approach.

> **Owner answers recorded on 2026-11-14, after the second-pass check** (the owner answered "recomendados ok" to the list the main session showed): N-1 the pilot is the goblin raider; N-2 gear bands and bending gear move to a follow-up stage; N-3 the 8-bit build step is added; N-4 one draw call per monster or up to three is decided on the pilot, where both are shown. N-6 (`Hurt`): the owner approved the death animation only and took the recommendations, and the second pass recommends leaving `Hurt` out, so it is **left out** unless the owner asks for it. **Still open: N-5** (where the hero's joints go), raised by the second pass after the owner answered. The stage is not approved until the owner says so.

Date: 2026-11-14. Branch: `feat/models-pass`. All line numbers refer to commit `5caa597` (main, Stages 1 and 2 merged; Stages 3, 4 and 5 are approved designs that are **not** on this branch). Symbols are named next to line numbers because the lines will move before this stage starts.

Status: **owner decisions applied (2026-11-14); second-pass check applied the same day** (critique, "Second pass": the hero's joints, skinned roots at the origin, the clip conversion, the pilot's criteria; decisions N-5 and N-6 added). The owner answered the open decisions, and the answers change the foundation of the stage: **every figure becomes a skinned mesh on a skeleton** (the hero, the guards, every monster, the bosses), **the dragon is a new model**, and **any monster is rebuilt where reduction and paint are not enough**. Section 13 records each answer with the owner's words and lists the four new decisions the answers create. Sections 5.6, 5.7, 6.1, 6.2, 6.4, 6.5, 8, 9, 10 and 13 were rewritten for the answers, section 3.5 holds the experiments that back the new foundation, and section 4.6 decides, figure by figure, what is rebuilt and what is kept. What the answers made moot (rigid figures with joint caps, cutting third-party bodies by bone weights, reducing the old dragon, Ashmantle as a kit, held poses) was removed; the review log at the end says what changed. Nothing shipped was changed to write this: no file under `public/models/`, `blender/`, `src/`, `tests/`, `scripts/` or `package.json`.

Inputs read: `scripts/blender/*.py`, `scripts/run-blender.mjs`, `tests/run-blender.test.ts`, `CREDITS.md`, the five GLBs (JSON chunk and buffers, measured), `src/engine/gltf.ts`, `blenderHero.ts`, `blenderMonsters.ts`, `blenderGear.ts`, `monsterMeshes.ts`, `playerMesh.ts`, `playerGear.ts`, `materials.ts`, `textures.ts` (material part), `humanoid.ts`, `worldBuild.ts` (guard part), `context.ts` and `input.ts` (camera), `src/__tests__/blender-hero.test.ts`, `lean-rig.test.ts`, `tests/credits.test.ts`, the approved Stage 4 design ("Combat with weight") and Stage 5 design ("Visual pass"), the foundation design and plan, and the shelved compression design on `origin/feat/reach`.

What was run is in section 3, with commands (3.5 for the skinning experiments of this revision). Everything ran in a scratch directory, with one exception: a twenty-line node probe had to sit beside the installed `three` package to import it, so it was written to the git-ignored `node_modules/` of this worktree, run once and deleted. The nine shipped binaries hash the same before and after (`sha256sum -c`, 9 of 9 OK) and `git status` is clean.

This stage lands **after Stage 5** and before Stage 6 (dungeons, more bosses).

---

## 1. Intent and why

The owner's words (translated): "it is an old-school game, but that does not mean it has to be shallow in visuals; it can be an old school 8k", and later: "we will need to work better on the models/Blender of the monsters, the character, etc." Other games' methods are fair inspiration; a specific game's character or look is not.

Reading: Stage 5 gives the world light, air and ground. The figures standing in that world are the next weakest thing. This stage makes the hero, the gear, the guards and the monsters better in **form, material and motion**, without changing a rule, a name or a save.

Five facts decide the design. All are measured (section 4) or seen in renders (section 3).

1. **Half of the model download is two third-party meshes.** The two castle guards (`guard.glb`) are a realistic knight of 53,598 triangles in a T-pose with no animation: 1,174,350 bytes on the wire, 31% of all model bytes, for two figures that stand still. The dragon is 34,750 triangles and 672,011 bytes on the wire, 53% of `monsters.glb`. Together they are 49% of the 3.74 MB.
2. **The eight procedural monsters read as dolls.** They are boxes and tubes with visible gaps at every joint, dark body colours (scorpion, robe, bark and leather between 9% and 16% luma; goblin skin 24 to 34%), and small parts (buttons, straps, studs) that vanish at play distance. The goblin raider and the goblin archer, and the dark ranger next to both, share one outline.
2b. **The dragon and the lesser demon do not move (critique C1).** Each body is one mesh directly under the figure's root; the dragon's seven pivots are empty, the demon's head, left arm and leg pivots are empty. `poseMonsterLimbs` turns those pivots, so in game the dragon only bobs and the demon moves its cleaver and wings. Stage 4's Ashmantle inherits this.
3. **Draw calls, not triangles, are what figures spend.** A monster is 22 to 68 separate meshes (the goblin 59, the scorpion 68); a gear piece averages 7 (506 meshes in 69 group nodes). Every one is a draw call, a second one in the shadow pass, and a hidden outline shell (`materials.ts` 80-109). A skinned figure needs one mesh per material family instead of one per rigid part: measured, seven figures of 59 rigid meshes are 826 calls a frame with a shadow pass, and seven skinned figures of three meshes are 42 (3.5, S8).
4. **Gear tiers differ by colour only.** Every metal helm is `Gear_helm`, every plate body `Gear_plate-body`, every scimitar `Gear_scimitar` (`gearSilhouette`, `playerGear.ts` 73-135); the tier is `item.color` on one shape. A new set does not change the hero's outline.
5. **Nobody has ever rebuilt these files safely.** The build scripts write `public/models/*.glb` and `blender/*.blend` in place and there is no way to look at a model here except a render. So the first deliverable is a safe build and a way to look.

### Essence to preserve (CALL-M1)

Stage 5's rule stands: **cut world, round figures, real air.** Figures stay smooth-shaded with a two-band light so they read against the faceted world. **Figures are now skinned meshes on named bones** (owner decision of 2026-11-14, section 6.1): limbs bend, and one skeleton and one set of animations serve many figures. The names the engine looks up do not change, because each bone carries the name of the pivot it replaces. No rule, formula, drop, name, save field or monster stat changes. Every node name, bone name, scale, material name and clip name the engine looks up is kept, or migrated with a declared test (section 8).

---

## 2. Constraints

| # | Constraint | Consequence |
|---|---|---|
| K1 | Stage 5 fixed the model download at 3.76 MB (its K2 and section 10) and keeps all five GLBs byte-identical. | This stage is the first allowed to change them. Its budget is a **lower** total (section 9). |
| K2 | The engine replaces every hero, gear and monster material by name and re-projects UVs (`blenderMonsters.ts` 97-145, `blenderGear.ts` 82-116, `blenderHero.ts` 198-276, `assignProjectedUvs` in `textures.ts` 256). GLB textures are ignored. Monsters and gear read each material's base colour (`extractColorHex`, `blenderMonsters.ts` 41-47); the hero reads **no** GLB colour (all set in `blenderHero.ts` 182-197 and recoloured by `playerMesh.ts` 126-185). The guard is the exception: `createCastleGuard` keeps the GLB materials (`worldBuild.ts` 567-582). No figure reads the GLB's `TEXCOORD_0` (critique H5). | Colour is authored as named materials plus vertex colour, never as an image (6.3). Figure exports drop `TEXCOORD_0`. |
| K3 | Frozen tests parse the GLBs with a bare `GLTFLoader` in node (`blender-hero.test.ts` 26-34). | Measured: a GLB with `COLOR_0` parses; a GLB with an embedded PNG fails with "self is not defined". Embedded textures are out. |
| K4 | `template.clone(true)` and outline shells that share the mesh geometry (`blenderMonsters.ts` 84, `materials.ts` 94) assume rigid meshes. Gear mounts on pivot objects (`playerMesh.ts` 193-373). Monster motion is written against pivots (`poseMonsterLimbs`, `monsterMeshes.ts` 810-902), and Stage 4 builds its flinch, knock-back and wind-up pose on the same pivots (its 6.5). | The owner chose skinned figures (2026-11-14). The design answers each of these: bones keep the pivots' names, positions and axes, so mounting and posing code keeps working (6.1.1); the clone and the outline shell change (6.1.3); the two paths coexist while figures migrate one at a time (6.1.5). |
| K5 | Blender 5.0.1, headless only, on a shared 16 GB machine. Scripts were written for 5.2 on Windows. | One Blender process at a time, 3 GB cap, 10-minute timeout. The comparison is structural, not byte-for-byte (7.2). |
| K6 | Third-party assets need a licence that allows redistribution, kept beside the asset and recorded in `CREDITS.md` (`tests/credits.test.ts`). | Procedural first. New third-party sources only CC0 or CC-BY, one owner sign-off each (CALL-M8). |
| K7 | New content gets an original look. Borrow technique, never a character. The owner named RuneScape, Tibia and Ragnarok as inspirations (2026-11-14): that means their spirit and techniques (clear silhouettes, one exaggerated trait per creature, gear progression you can read), never a replica of a specific creature or character of any game. | Every rebuilt figure and every kit piece is designed here from role, not from a reference character. |
| K8 | Existing tests are frozen (foundation plan rule 0.3.3). | Replacements are declared in advance (8.3). |
| K9 | No new runtime dependency; `src/state` and `src/data` do not import `three`; no `src/` file over 1000 lines. | Tools are plain node scripts and Blender Python. New pure tables live in `src/data`. |
| K10 | Stage 4 separates a monster type from its mesh: `MonsterDef.model`, `tint`, `modelScale` (its 6.8). | A new mesh is one `Monster_<modelKey>` node and one data field. This stage depends on that mechanism and adds no rule. It adds two optional look fields beside it: `kit` (pieces added over a base figure) and `body` (a different mesh on the same rig, for Ashmantle), so no model key changes (8.2). |

---

## 3. What was run, and what it showed

Scratch root: `<scratch>/mp`. Every Blender call was wrapped as `timeout 600 systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 /usr/bin/blender --background --factory-startup ...`, one at a time.

### 3.1 Which render engine works with no display

A 480 by 480 probe (one mesh, one sun), then real models:

| Engine | Works headless | Time per frame | Use |
|---|---|---|---|
| Cycles, CPU, 16 to 24 samples | yes | 0.2 to 1.6 s (24 cores) | **The review engine.** Real shadows, deterministic, no graphics driver. |
| Workbench | yes (software GL; prints `libEGL` warnings and still renders) | 0.2 to 3.0 s | Fast flat check; fallback. |
| EEVEE (`BLENDER_EEVEE`) | yes | 11 to 21 s | Not used: software GL makes it 20 to 50 times slower for no gain. |

Thirty shots of all ten monsters took about 35 s in Workbench; three shots of the hero took 1.2 s in Cycles.

### 3.2 Does a full build run on Blender 5.0.1

Yes. The trap was avoided without editing a script: every script derives the repository root from its own path (`build_hero.py` 420, `build_monsters.py` 2915, `build_gear.py` 3103, `build_world.py` 2281, `export_guard.py` 8), so `scripts/blender/` and `blender/examples/` were **copied** into a fake root in scratch and run from there.

| Script | Exit | Wall time | Output against the shipped file |
|---|---|---|---|
| `build_monsters.py` | 0 | 4 s | 4,879,064 bytes (shipped 4,879,168) |
| `build_gear.py` | 0 | 3 s | 2,331,672 (2,331,560) |
| `build_world.py` | 0 | 3 s | 2,776,568 (2,776,656) |
| `build_hero.py` | 0 | 14 s (it renders an EEVEE preview) | 216,844 (216,844) |
| `export_guard.py` | 0 | 2 s | 1,705,360 (1,705,360) |

Shipped hashes at the R0 re-check (HEAD `0a1d0dc`; `public/models/` unchanged since 2026-11-10, commit `3e2ad8c`; raw and Brotli quality 3 sizes re-measured equal to 4.1), SHA-256:

```
92e8eb785b0b86bbcbc22d11462c53d493ef380e4946abc0f4f4567517cd678a  public/models/gear.glb
85fb16a371616238532278485c9520a2320132a3a75620467829050602eb5734  public/models/guard.glb
694f652b8471463a8eebb53cc9001d51e0d7544b8c028d8fc24fd64fa4351309  public/models/hero.glb
a4a4d00b355364d8b57baa35e15bb521c9ec420571f95002cd1a6ef3bd416fff  public/models/monsters.glb
0337e5bf869a4a8c50c46381a53aa5f835b62fdadfd4a9543107587ce2251500  public/models/world.glb
```

A structural comparison (prototype of 7.2) found, for all five files: the same node names, hierarchy, translations, rotations and scales, the same triangle and vertex count per mesh, the same bounds, the same material definitions, the same `extras`, and identical animation sample data. Geometry bytes are identical everywhere except three guard meshes, whose floats differ by at most 0.00022. No file is byte-identical: the generator string differs (`Khronos glTF Blender I/O v5.0.21` here, `v5.2.41` shipped).

Also seen: the exporter's Draco library is missing on this machine (irrelevant, Draco is not used); the hero script extracts the Kai zip into `blender/examples/kai/` and writes `scratch/kai_baked_preview.png`, two more write targets inside the repository (both git-ignored); its `pack_all` logs missing texture paths, one of them the original author's home directory, which shows that absolute paths travel inside `.blend` files (section 11).

### 3.3 Technique probes

| Probe | Result |
|---|---|
| Guard: join by material, decimate | 53,598 to 5,999 triangles, 27 meshes to 2, wire 1,174,350 to 258,965 bytes. Rendered at camera distances 5.4, 8.5 and 26: no visible difference. |
| Dragon: decimate the body to 12,000 | 34,750 to 21,568 in total (the body is 25,182 of them; the teeth are 8,928 and the eyes 640), wire 672,011 to 455,273. |
| Goblin: join meshes that share pivot, material, outline flag and "eye" in the name | 59 meshes to 29, same triangles. |
| Vertex colour through the frozen loader path | `COLOR_0` arrives as the `color` attribute and the loader sets `vertexColors` on the material. Works in node. |
| Embedded PNG through the same path | Fails in node: "self is not defined". |
| Baking ambient occlusion into vertex colour (Cycles, CPU, 16 samples) | Works headless: the goblin's 59 meshes in 5.3 s. The exporter writes `COLOR_0` as four 16-bit values, 8 bytes per vertex. On the **unchanged** goblin (15,214 vertices) the file grows 611,004 to 749,080 raw and 121,155 to 152,870 on the wire: **+26%**. |
| Motion review | The importer turns each clip into NLA tracks per pivot **and leaves `Idle` as every pivot's active action**, which overrides the tracks. **Corrected by the critique (C2, E3):** muting tracks alone shows `Idle`; the strip `hero-slash-strip.jpg` is `Idle`, not `Slash`. With the active action cleared, `Slash` swings the right arm 1.84 rad with a wind-back before the strike, and turns the torso 0.90 rad. |

### 3.4 Not run

No test suite, no build, no dev server, no in-engine capture, no real GPU. (The first study opened no browser; the revision of 2026-11-14 opened one test page, 3.5.) `run-blender.mjs export` (re-export of a `.blend` saved by 5.2) was not tried. Nothing was run through `run-blender.mjs` itself, because it has no output option.

### 3.5 Skinning experiments (added 2026-11-14 for the owner's decisions)

Scratch root `<scratch>/mp2` (session-scoped; every number is written here). Same Blender wrapper as above, one process at a time, 3 to 12 s each. Node probes imported three 0.169 by absolute path, so nothing was written into the worktree. One page was opened in a headless Chromium (WebGL 2) to compile shaders; it loaded two files from the scratch directory through a throw-away static file server on `127.0.0.1` that ran for about a minute (the browser tool refuses `file:` addresses). No dev server, build or test suite ran.

| # | Experiment | Result |
|---|---|---|
| S1 | **Bone rest frames.** An armature whose bones all point straight up with roll 0, exported with `export_yup`. | All 12 joint nodes export with **no rotation**, and load in three with identity quaternions. A bone then has the same axes as today's pivot empties, so `bone.rotation.x` means what `pivot.rotation.x` means today. |
| S2 | **A rigged, weighted figure built by script.** Body: a skin modifier over a stick graph, voxel remesh, smooth, decimate to 5,000 triangles (2,502 vertices). Weights: Blender's automatic weights (`parent_set(type='ARMATURE_AUTO')`) against a second, limb-aligned armature with the same bone names, then re-bound to the world-aligned one (weights are stored by bone name). | Automatic weights took 0.05 to 0.12 s headless and left **0 unweighted vertices** on both figures, at most 4 influences per vertex. Six poses rendered (rest, two walk frames, wind-back, strike, a deep crouch with the arm overhead): shoulders, elbows, hips and knees bend with no gap; the knee pinches at about 90 degrees, as linear skinning does. The exporter warned "mesh is not valid" for the remeshed body (a `validate()` call is owed) and the head ball of the stick graph collapsed, which is a fault of the probe's graph, not of the method. |
| S3 | **Export and load.** Two clips (`Walk` 32 frames, `Slash` 24 frames) keyed on pose bones, NLA tracks, `export_optimize_animation_keep_anim_armature=False`. Parsed in node by a bare `GLTFLoader`. | One `SkinnedMesh`, 12 bones, `JOINTS_0` as 4 unsigned bytes and `WEIGHTS_0` as 4 floats per vertex. Clips arrive as **rotation tracks only**, `LINEAR`, one key per frame (33 and 25 keys), 7 and 4 tracks. With the exporter's default the clips carried position, rotation and scale for every bone (36 tracks), which matters for S4. |
| S4 | **One clip on two figures.** The human's `Walk` played on a second figure with other proportions (hips at 0.55 instead of 0.90, longer arms, bigger head) and the same bone names. | Works with **no retargeting**: the leg bone turns 0.549 rad on x on both, and the second figure keeps its own bone lengths. With the default export (position tracks) the same clip overwrote the second figure's knee offset with the first one's (-0.42 instead of -0.26): shared clips must be rotation-only. **Not covered:** the two figures were bound in nearly the same pose (arms 28 and 35 degrees out). A rotation-only clip is relative to the bind pose, so a figure bound in a very different pose would play the clip offset by that difference (6.1.1 rule 3). |
| S5 | **Cloning.** `scene.clone(true)` against `SkeletonUtils.clone`. | `clone(true)` leaves the copy bound to the **original's** bones. `SkeletonUtils.clone` gives the copy its own bones and shares the geometry. A mixer on the copy turned the right arm -1.269 rad and moved a hand vertex 0.78 units; the original stayed at rest. A rigid mesh added as a child of the elbow bone followed it. |
| S6 | **Culling and picking.** | A `SkinnedMesh`'s bounding sphere is computed once and **not refreshed** when the pose changes (rest radius 0.918; the true sphere after the pose was 0.995 with the centre 0.085 away). A ray against the posed skin hits it, in 9 ms for 5,000 triangles on the CPU. |
| S7 | **Shaders, in a browser.** A skinned test mesh with (a) a copy of today's `facetMaterial` patch (today's: before Stage 5; removed by Stage 5) and (b) the same patch moved after `skinnormal_vertex`; the outline material on a plain shell, on a skinned shell, and with three's skinning chunks added. | (a) the mesh deforms, but the band is computed from the **bind-pose normal**: a face turned to the ground stayed lit (130 against 108 with the fix). (b) correct. The outline as written **stays in the bind pose** even on a `SkinnedMesh`; with `skinning_pars_vertex`, `skinbase_vertex`, `skinnormal_vertex` and `skinning_vertex` included it follows the bend. No shader error. |
| S8 | **Draw calls**, same page, one shadow-casting light. | Seven figures of 59 rigid meshes: **826** calls a frame. Seven skinned figures of one mesh: **14**. Of three meshes: **42**. |
| S9 | **Bytes.** Brotli quality 3. | The 5,000-triangle body alone: 91,156 raw, **81,344** on the wire (smooth organic floats compress about 1.1:1). With skin: 143,448 raw, **97,010** on the wire (+15.7 kB, about 6.3 bytes per vertex; the weights are 14.2 kB of it). Two rotation-only clips add 8,280 raw, 2,334 on the wire. |
| S10 | **Smaller without a decoder.** A 60-line node script rewrote the same file with 8-bit normals (`KHR_mesh_quantization`, which three's loader reads natively) and 8-bit normalised weights (plain glTF). | 151,728 to 101,812 raw, **99,344 to 69,862 on the wire (-30%)**. The bare `GLTFLoader` parses it; the worst difference of any posed vertex is 0.5 mm. |
| S11 | **Two rigs with the same bone names in one file.** | The loader renames the second set (`Torso`, `Torso_1`). So bones in a file that holds several figures are prefixed by the builder (`goblin_Torso`, as today's pivots are) and the engine strips the prefix on the clone; nothing depends on the loader's renaming. |
| S12 | **A variant that shares a body.** A second figure with linked mesh data and its own armature. | The file grew from 143,440 to 255,444 bytes: **a skinned body is not shared between two armatures on export**. Variants therefore stay kits attached to a clone of the base figure (5.6), not second bodies. |
| S13 | **The hero with its author's weights.** The hero's source (`kaiV2.blend`) has a 59-bone armature and weights on all ten meshes the hero is built from. The 59 groups were folded onto the 16 bones of the biped rig (fingers into the hand, spine into the torso, feet into the foot) and the meshes bound to a world-aligned rig at the author's joint positions. | Every group mapped; at most 4 influences per vertex after folding. Five poses rendered (rest, arms down, a stride, a strike, a crouch): the body bends at every joint with no tear visible at thumbnail size. Wire size, geometry only: **105,189** with skin and no UVs, against 102,020 for the same meshes rigid with UVs. So skinning the hero costs about what dropping its unused UVs saves. |
| S14 | **Second pass: where the author's joints are** (`kaiV2.blend`, bone heads put through `build_hero.py`'s own transform, glTF axes, x centred by +0.011). | Shoulders **±0.178 at 1.478**, elbows ±0.31 at 1.229, wrists ±0.44 at 1.02, hips **±0.111 at 1.007**, knees ±0.186 at 0.604, ankles 0.166, `neck` 1.504, `head` 1.594. Today's pivots (`LEAN_RIG`) sit at shoulders ±0.28 at 1.50, hips ±0.11 at 0.90, knees 0.52: the shoulder pivot is 10 cm outside the author's shoulder joint, the hip 11 cm below it, the knee 8 cm below it. The source pose is an A-pose: upper arm 28 degrees out, forearm 32, legs about 10. Today's clips already compensate it: every clip turns `LeftArmPivot` by +0.28 and `RightArmPivot` by -0.28 on z, which brings the A-pose arms in to about 14 degrees. 59 deforming bones; all ten meshes carry an armature modifier and 59 groups; 4 coat vertices are unweighted. |
| S15 | **Second pass: a skinned figure in the engine's own clone path.** An armature `Monster_probe` placed at glTF (6, 0, 2), as `monsters.glb` lays its figures out, with prefixed bones; cloned with `SkeletonUtils.clone`, reset to the origin, children moved into a group (what `upgradeMonsterRigWithGltf` does). | **Every vertex lands 6.32 off** (the length of (6, 0, 2)): the exporter writes inverse bind matrices in scene space, so they carry the figure's place in the file, and the engine's reset does not. With the armature at the origin the error is 0. Then: `bone.rotation.x = 1` moves an arm vertex exactly as a rotation about the shoulder joint (error 0); a rigid object on the elbow bone, with the torso turned 0.5 and the arm 1.0, lands exactly where the same offsets on a pivot chain land (error 0); two clones pose independently and the template stays at rest. |
| S16 | **Second pass: Euler order of the clips.** An empty keyed the way `build_hero.py` keys pivots (`t2b_euler`, Blender `XYZ`) against a bone keyed directly with the same three-space numbers. | With the bone in Blender mode **`XZY`** the two quaternions are identical (0 rad apart; both equal three's `Euler(rx, ry, rz, 'YZX')`). In mode `XYZ`, which the plan's `make_clip` named, the same numbers are 0.34 rad off. A bone's local axes are the figure's axes (S1), so no `t2b_euler` is applied on bones. |
| S17 | **Second pass: shared skeleton data and names.** | `SkeletonUtils.clone` gives every clone its own bones but **one shared `boneInverses` array** with the template. A shell bound with `shell.bind(mesh.skeleton, mesh.bindMatrix)` mid-pose follows the mesh exactly; a shell bound with `shell.bind(mesh.skeleton)` recomputes the inverses at the current pose, is 14 units off, and **moves every other instance** of that figure (a second clone's vertex moved 13.5). Clip tracks keep the builder's prefix (`probe_RightArmPivot.quaternion`); after the bones are stripped, a clip only drives them once its track names are stripped too (then 0 rad error). `SkinnedMesh.boundingSphere` is `null` until first use and is copied by `clone`, so a sphere set on the template reaches every instance. The 8-bit step of S10 run on this file: normals arrive as normalised `Int8Array`, `getX` returns unit vectors, positions stay `Float32Array`, no `uv` attribute exists, so `assignProjectedUvs` creates its own `Float32` one. |

S14 to S17 were run by the second-pass check (critique, "Second pass"), in a scratch directory, with Blender 5.0.1 under the same wrapper and node importing three 0.169 by absolute path; nothing in the worktree was written.

What these did **not** show: any of it in the game; the look of automatic weights on a figure with a head, hands, clothes and a weapon; the hero's author's weights bent about the joints it will really have (S13 bound at the author's joints and S14 measured them; the plan now binds there, N-5); a real GPU; frame time.

---

## 4. Audit of every model

Triangles, meshes, materials and bytes are read from the GLBs. "Wire" is Brotli quality 3 from node's `zlib`, the measure the compression design matched to the live server (hero 137,913 on both; total 3,736,447 against 3,761,862 live). No GLB has a texture, an image, a skin or a morph target. Every attribute is float `POSITION`, `NORMAL`, `TEXCOORD_0`.

### 4.1 Files

| File | Raw bytes | Wire | Triangles | Meshes | Materials | Clips |
|---|---|---|---|---|---|---|
| `hero.glb` | 216,844 | 137,913 | 5,304 | 18 | 18 | 10 |
| `gear.glb` | 2,331,560 | 668,121 | 73,504 | 506 in 72 nodes | 8 | 0 |
| `monsters.glb` | 4,879,168 | 1,266,221 | 98,644 | 399 | 35 | 0 |
| `guard.glb` | 1,705,360 | 1,174,350 | 53,598 | 27 | 2 | 0 |
| `world.glb` | 2,776,656 | 489,842 | 41,776 | 433 | 15 | 0 |
| **Total** | **11,909,588** | **3,736,447** | | | | |

### 4.2 Figures

Screen height is at 1080 lines, 50 degree camera (`renderer.ts` 112), at the three distances that matter: 5.4 (the start value, `context.ts` 84-85), 8.5 (camera reset, `input.ts` 177) and 26 (zoom limit, `input.ts` 150). In-game size is the GLB height times the group scale the procedural builder sets (`monsterMeshes.ts` 140, 245, 312, 386, 443, 519, 583, with `scale` from `catalog.ts` 441-476 and `world.ts` 45, 65; the chicken and the dragon builders set no scale).

| Figure | Source | Triangles | Meshes | Materials | Motion | Pixels tall at 5.4 / 8.5 / 26 | Weakest point at play distance |
|---|---|---|---|---|---|---|---|
| Hero (Kai) | Third party, CC-BY 3.0 (uchiha007), cut into 18 rigid parts by `build_hero.py` | 5,304 | 18 | 18 | 10 clips on 10 pivots; 3 to 16 channels each | 410 / 260 / 85 | Seams open at knee and elbow (visible as a light band at the knees). The face is faint. Attack clips are sound (`Slash`: arm 1.84 rad with a wind-back, torso 0.90 rad). Weak, measured as largest rotation range: `Idle` 0.02 to 0.06 rad on every pivot, `Fish` 0.10 rad, torso in `Walk` 0.04 rad, torso in `Lunge` 0.24 rad. |
| Castle guard (2 placed) | Third party, CC0 (Xali); the author says the base mesh came from a marketplace model with unstated terms (`CREDITS.md`) | 53,598 each | 27 | 2 | none | 400 / 250 / 82 (body) | T-pose, sword pointing at the sky, one grey, realistic proportions in a stylised game. 107,196 triangles in the town for two statues. **The weakest asset per byte.** |
| Chicken | Procedural | 4,680 | 38 | 6 | code, 5 pivots | 178 / 113 / 37 | The best-reading figure today. Too many meshes for its size. |
| Goblin raider | Procedural | 8,292 | 59 | 10 | code | 343 / 218 / 71 | Box torso, tube limbs with gaps, near-black green. Shield and spear carry the outline alone. |
| Goblin archer | Procedural | 6,640 | 58 | 11 | code | 371 / 236 / 77 | Same outline as the raider; the hood hides the one feature (the ears) that says "goblin". |
| King scorpion | Procedural | 10,488 | 68 | 6 | code | about 540 / 345 / 113 | Good outline. Thin legs alias; 68 draw calls; one dark value. Stage 4's Saltback Stalker is this mesh, larger and darker. |
| Dark wizard | Procedural | 3,980 | 24 | 9 | code | 560 / 355 / 116 | The hat reads; the robe is a cone with stripes; the staff merges with the body. |
| Dark ranger | Procedural | 5,340 | 37 | 8 | code | 500 / 317 / 104 | Reads as "dark figure with stick". Stage 4's Thornwatch Marksman is this mesh, tinted green. |
| Hill giant | Procedural | 7,288 | 45 | 9 | code | 785 / 498 / 163 | Good mass. Joints are stacked balls; the club is lost in front of the belly. |
| Moss guardian | Procedural | 6,968 | 43 | 6 | code | 919 / 583 / 191 | Dark brown on dark green; the glowing core is the only thing that reads. |
| Lesser demon | Third party body, CC0 ("Red Devil"), plus procedural wings and cleaver | 10,218 | 22 | 7 | code | 907 / 576 / 188 | **Body, head and arms are one mesh under the root; only the cleaver and wings move.** T-pose arms; wings attached off-centre; realistic thin limbs beside doll-like neighbours. Source has an armature. |
| Dragon (Elvarg) | Third party, CC-BY 3.0 (yoji) | 34,750 | 5 | 3 | **none visible**: the code turns head, wings and legs pivots that hold no mesh; the body only bobs | 772 / 490 / 160 (to the wing tips) | **A statue.** One flat dark green. 8,928 of its triangles (26%) are teeth nobody sees. Stage 4's Ashmantle is this mesh in ash grey at 1.2 times the size. Source has an armature (`Armature.001`). |

Monster wire bytes: the dragon alone is 672,011 (measured); the goblin raider 121,155 (measured); the other eight share about 470,000.

### 4.3 Gear

69 group nodes, 47 silhouettes, 73,504 triangles, 506 meshes, 8 semantic materials (`gear_primary`, `gear_trim`, `gear_glow`, `gear_wood`, `gear_leather`, `gear_dark`, `gear_white`, `gear_crimson`). Procedural, except four pieces that start from the CC0 "Low-Poly Weapons" pack (`build_gear.py` 846, 910, 971, 1667). Heaviest: mace 2,908 triangles, staff 2,856, the helms 1,300 to 2,800. A staff is 11 meshes.

Weak points: tiers share one shape (fact 4); the three third-party blades have ragged edges that shimmer; a full ten-slot loadout is more than 60 draw calls before outlines and shadows; a helm of 2,768 triangles sits on a head 40 pixels wide.

### 4.4 World props

`world.glb` (29 props, 41,776 triangles) is **out of scope**. Stage 5 keeps it byte-identical and merges it at run time (its 6.6). The safe pipeline of section 7 covers it so that a later stage can rebuild it.

### 4.5 An engine cost found while reading

Every monster instance clones every geometry (`blenderMonsters.ts` 96), and every gear clone does the same (`blenderGear.ts` 85). Thirty-six monsters hold thirty-six copies. Fewer, smaller meshes shrink this; removing the clone is not this stage's work.

### 4.6 Rebuilt or kept, figure by figure (owner: "any other mobs, we can rebuild", 2026-11-14)

"Kept" means the design and proportions stay and the figure gets a skeleton, a skin and paint. "Rebuilt" means a new original mesh designed to section 5.

| Figure | Decision | Rig | Reason |
|---|---|---|---|
| Hero (Kai) | **Kept, re-rigged** | Biped | The owner keeps the hero's identity. Its source already carries its author's armature and weights (3.5, S13), so the skin is hand-made, not automatic. The bones sit at the **author's** joints, in the source's A-pose (S14; decision N-5), not at `LEAN_RIG`'s pivots. |
| Castle guards | **Rebuilt from the hero body and armour** (owner: "pode refazer") | Biped | Two instances of the skinned hero wearing existing gear; `guard.glb` and the knight's `.blend` are deleted. |
| Chicken | **Kept, re-rigged** | Biped (wings on the arm bones), **posed in code** | The best-reading figure today. It only needs fewer meshes and a skin. Its wings fold back along a horizontal body, far outside the biped reference pose, and a bird's visible leg joint bends the other way from a human knee, so the hero's `Walk`, `Slash` and `Death` would look wrong on it. It keeps today's code poses (on bones) and is exempt from the 20-degree bind rule; it is the one skinned figure that never plays a shared clip (second-pass fix). |
| Goblin raider | **Rebuilt** (the pilot) | Biped | A box doll with gaps at every joint; nothing short of a new continuous body fixes it. |
| Goblin archer | **Rebuilt** | Biped | Shares the raider's outline today; gets its own head, hood and stance on the raider's proportions. |
| King scorpion | **Kept, re-rigged** | Crawler | Good outline. Chitin segments are rigid by nature, so its plates keep hard weights; the legs are thickened, the tail gets a chain of bones, the values are lifted. |
| Dark wizard | **Rebuilt** | Biped | A cone with stripes; a robe that bends needs a real skinned skirt, and the staff must leave the body outline. |
| Dark ranger | **Rebuilt** | Biped | Reads as "dark figure with stick"; needs a cloak outline of its own. |
| Hill giant | **Kept, re-rigged** | Biped | Good mass. The stacked-ball joints disappear when its parts are fused into one skin; the club moves to its side. |
| Moss guardian | **Kept, re-rigged** | Biped | Stone and bark do not bend: hard weights suit it. It needs value separation, not a new shape. |
| Lesser demon | **Rebuilt** | Biped, with wing and tail bones | A realistic thin third-party body in a T-pose beside stylised neighbours; wings off-centre. A new original demon on the shared rig replaces it. Fallback if the scripted demon fails the owner's look: keep the CC0 body with its author's armature and weights. |
| Dragon | **New model** (owner: "build a new one") | Dragon | The old mesh is a statue in one flat green with 26% of its triangles in teeth. |
| Ashmantle the Slag Wyrm | **New model of its own** | Dragon | The owner asked for its own model rather than a kit on the old mesh. It shares the dragon's skeleton and clips and nothing else. |
| Saltback Stalker, Thornwatch Marksman | **Kits** on the scorpion and on the rebuilt ranger | Crawler, Biped | A second skinned body would cost a full body in bytes (3.5, S12); a kit costs a few kB. |
| Camp captain, swarm creature, dungeon boss | Stage 6 | Biped, Crawler, Biped | They arrive on rigs that already exist, with the clips those rigs already have. |

Three third-party sources stop being shipped: the knight (deleted), the old dragon and the Red Devil (their files and licence notes stay under `blender/examples/` until the owner removes them; their rows move to the "kept in the repository, not shipped" part of `CREDITS.md`). The hero stays CC-BY 3.0.

---

## 5. Art direction for figures

Working title: **"Carved figures."** A figure is a wooden game piece carved by a good hand: few planes, each one chosen, painted in a handful of colours, and it moves with weight. This is what "old school 8k" means for a character: the richness is in **form** (a shape you recognise as a black cut-out), **material** (three or four surfaces that each answer light differently) and **motion** (anticipation, weight, follow-through). It is never polygon count, texture resolution or realism.

### 5.1 The three-read rule

Every figure is judged at three sizes, and each size has one job.

| Distance | Hero's height on screen | The figure must tell you |
|---|---|---|
| 26 (far) | about 85 px | **What it is.** Shape class only: biped, beast, flyer, crawler; small, human, large, huge. Tested as a black silhouette. |
| 8.5 (play) | about 260 px | **What it does and how strong it is.** Role (melee, ranged, caster), gear tier, facing. |
| 5.4 (close) | about 410 px | **What it is made of.** Material, face, one or two crafted details. |

A detail that serves none of the three is deleted.

### 5.2 Proportions

- Humans are 5 to 5.5 heads tall. Hands and feet are 15% larger than life, weapons 20% larger. The hero's shoulders, hips, elbows and knees sit at its author's joints (3.5 S14, decision N-5), not at `LEAN_RIG`'s positions, which only the procedural placeholder rig keeps (8.1).
- Mass sits in few large forms. A torso is one tapered form, not a box with a belt, a harness and four studs.
- **Exaggerate the one feature that names the creature**: the goblin's ears and jaw, the giant's shoulders and hands, the wizard's hat and sleeves, the scorpion's claws and tail, the demon's horns and wings.
- No two species share a silhouette at 85 px. The check is a sheet of black cut-outs of the whole roster (7.3).

### 5.3 Silhouette rules

1. One clear **lean**: every figure has a rest pose with a line of action (forward hunch, proud lean back, low crouch). No T-pose, no A-pose with straight arms.
2. Arms and weapons are **outside** the body outline in the rest pose. A club in front of the belly does not exist at 85 px.
3. **Negative space**: gaps between arm and body, between legs, under a tail. Filled outlines read as blobs.
4. **Asymmetry** in one place: one pauldron, a weapon side, a broken horn.
5. Nothing on screen thinner than 6 px at distance 8.5, which is 0.044 world units. Thinner parts (bow strings, fingers, studs, buttons, teeth) are thickened, merged into the form, or removed.

### 5.4 Palette and material language

- **Five materials at most per figure**: two for the body (main and under-side), one secondary (cloth, leather, wood), one accent, and at most one emissive.
- **70 / 25 / 5**: main colour, secondary, accent by visible area.
- **Value range 25% to 75%.** Nothing darker than 18% sRGB except eyes and deliberate voids: today's scorpion (10 to 16%), wizard robe (9%), ranger cloth (14%), guardian bark (12%) and leather (13%) turn to mud in shadow, and the engine's albedo tiles and shadow band darken them further, where Stage 5's sky-coloured shadow needs something to tint.
- **Hue belongs to the species, value to the role.** Goblins are olive, the dunes creatures ochre and bone, the woods creatures bark and moss, the volcanic ones slate and ember. Inside a species, the caster is lightest, the brute darkest.
- **Four surface families**, each a named material so the engine can treat it (K2): skin or hide (albedo tile, soft), cloth (double-sided, matte), hard (metal, horn, chitin, bone: plain colour, crisp band), glow (small, saturated, the only thing that blooms: Stage 5's 5.2).
- **Painted depth without textures**: every figure carries a vertex-colour layer baked by the builder: ambient occlusion in creases, a top-to-foot gradient of about 15%, and a slight warm-to-cool shift from front to back. It multiplies the material colour. It is what makes a 5,000-triangle figure look carved instead of plastic (6.3).

### 5.5 How gear tiers read at a glance

(The direction stands. Building the bands moves to the follow-up gear stage, decision N-2; this stage only merges gear meshes.)

Colour stays the tier's name (bronze is bronze). Shape now tells the **band**:

| Band | Shape language | Trim | Glow |
|---|---|---|---|
| Plain (the low tiers) | Round, simple, close to the body. | none or one line | none |
| Forged (the middle tiers) | A ridge, a flange, a raised collar: one added form per piece. | edges | none |
| Crested (the high tiers) | A crest, wings or horns that break the hero's outline. | edges and an emblem | one small gem |

A player who sees an outline with a crest knows the hero is strong before seeing its colour. Named unique pieces keep their own shapes. Which item is in which band is a data table, checked by a test (plan G1). No item, stat or name changes.

### 5.6 How a recolour stays distinct

A tint alone is never a new monster. A variant must change, against its base:

1. **one silhouette element** that survives the black cut-out at 85 px (a different head, tail, back or weapon);
2. **value**, by at least 15 points;
3. size, as Stage 4 already does.

It is built as a **kit**: a clone of the base figure plus two or three rigid pieces of its own, each attached to the base bone it is named after (measured: a second skinned body is not shared on export, 3.5 S12, so a kit is the only cheap variant). Saltback Stalker: salt-crusted back plates, a forked double sting, heavier claws. Thornwatch Marksman: a thorn-wreathed hood, a tall bramble quiver, a longer bow.

**Ashmantle is not a kit** (owner, 2026-11-14: the dragon is rebuilt and Ashmantle gets its own model). It is a second body on the dragon skeleton: heavier in the chest, a slag crown fused to the skull, back plates with glowing seams, a clubbed tail. It shares the dragon's bones, clips and nothing else, and it must pass the same test against the dragon as any variant: a different black cut-out at 85 px.

### 5.7 Motion

- **Smooth, not held** (owner, 2026-11-14: "smooth"). Clips are authored on a twelve-a-second pose grid, few strong poses with eased moves between them, and exported as one `LINEAR` key per frame at 24 a second (measured, 3.5 S3), so the game interpolates. No `STEP` clip is built.
- **Every attack has three beats**: anticipation (the body goes the other way first), the strike (two frames), the follow-through with a settle.
- **The torso and head lead.** A swing starts in the hips and chest and the arm arrives last.
- **Joints bend.** Elbows and knees are real joints now: a swing folds the forearm, a step folds the knee, a hit folds the spine. This is the visible gain of skinning in motion.
- **Idle is alive**: weight shift, breath, a look around, and one small trait per species where a task adds it (the goblin scratches, the giant rolls a shoulder).
- **One library per skeleton** (6.5): a figure does not get animations of its own unless its silhouette needs one. A goblin swings with the hero's `Slash`; Ashmantle bites with the dragon's `Bite`.
- Stage 4's reactions (hit stop, flash, flinch, knock-back, wind-up pose) are drawn by the engine from events, on the same bone names they used as pivots (6.1.3).

---

## 6. Technique

### 6.0 How established low-poly and stylised games build characters (added by the critique)

Generic practice only; no specific game's character or look is borrowed.

| Topic | Common practice in low-poly and stylised 3D games | This design | Verdict |
|---|---|---|---|
| Silhouette and proportions | Read at thumbnail size first; big heads, hands and weapons; one exaggerated feature per type; tested as black cut-outs | 5.1 to 5.3, the 85 px roster sheet | Mainstream; good. |
| Palette and value | A small palette per figure, value separating figure from ground, hue per faction | 5.4 | Mainstream; good. |
| Paint layer | Either hand-painted textures (the classic stylised route) or vertex colour / colour palettes on a gradient atlas (common in low-poly indies); baked AO either way | Vertex colour with baked AO (6.3) | Textures are ruled out here (K2, K3), so vertex colour is the only paint layer. It is a real technique, not a compromise, but it is coarse on sparse meshes: detail needs vertices where the colour changes. |
| Rig | **Skinned meshes are the norm** in 3D games since the late 1990s, including low-poly ones. Rigid segmented figures were the norm before that, and survive today as a deliberate retro or toy look, or for robots, armour and insects | Skinned meshes on three shared skeletons (6.1) | **Superseded by the owner's decision of 2026-11-14: every figure is skinned (6.1).** The design now follows mainstream practice here. |
| Modular gear | Gear as separate meshes swapped on sockets or bones; tier shown by shape and trim as well as colour | Rigid gear pieces on bones (6.1.4); bands (5.5, follow-up stage) | Mainstream; good. |
| Animation | Key poses with strong anticipation and follow-through, curves eased; stepped timing used deliberately in some stylised titles | Pose tables sampled to smooth clips, one library per skeleton (6.5) | Mainstream; shared rigs and shared clips are how games with large rosters afford them. |
| Level of detail | Mesh LODs or impostors for large crowds and long views; often none for short-view games | None (6.6) | Fine for a short camera and a modest crowd. |
| Draw calls | Merge by material per character, atlas materials, instancing for crowds | Merge at build time (6.4) | Mainstream. |

### 6.1 Every figure is a skinned mesh on a shared skeleton (decided 2026-11-14)

The owner's words: "Mesh that bends for everything, including the hero. It makes it easier for us to reuse some things, if possible." This replaces the earlier recommendation (rigid segments). The rest of 6.1 is the design of that decision.

#### 6.1.1 The rule that makes it affordable: a bone is the pivot it replaces

Three rules, each checked by the manifest (7.2):

1. **Same names.** A bone carries the name of the pivot it replaces: `Torso`, `HeadGroup`, `LeftArmPivot`, `RightElbowPivot`, `LeftKneePivot`, `LWing` and so on; in `monsters.glb`, where several figures share a file, `<model key>_<Bone>`, exactly as today's pivots are named (`goblin_HeadGroup`). **Positions are not kept for the hero** (second pass, S14): its bones sit at the author's joints, because the author's weights bend there; gear offsets are re-derived for the moved joints (6.1.4). No engine code reads a monster pivot's position (checked: only `rotation` is written in `poseMonsterLimbs`, and gear mounts only on the hero, merchants and guards), so monster bones are placed where the new body's joints are.
2. **World-aligned rest.** Every bone's rest rotation is identity: in Blender every bone points straight up with roll 0. Measured (3.5, S1): the joints export with no rotation. A bone's local axes are then the figure's axes, as a pivot empty's are today. Clips are therefore keyed in the figure's (three's) axes directly, in Blender rotation mode `XZY` or as quaternions, never through `t2b_euler` and never in mode `XYZ` (S16: `XYZ` is 0.34 rad off for a three-axis rotation).
2b. **Each figure's root sits at the origin of the file** (second pass, S15). The exporter writes inverse bind matrices in scene space, so a skinned figure laid out at (6, 0, 2) as today's monsters are is drawn 6.32 units off once the engine resets the clone. Every skinned `Monster_` (and `Kit_`) node and `HeroRoot` has an identity transform; the review renderer lays figures out for sheets; the manifest test refuses a skinned root with any transform.
3. **The bind pose stays close to the skeleton's reference pose.** Each skeleton has one reference pose, recorded in the manifest. **The biped's is the hero source's own A-pose** (S14: upper arm 28 degrees out, forearm 32, legs about 10, spine upright), not arms straight down: today's ten clips were written for that pose (they turn the arms in by 0.28 rad), the author's weights were made in it, and binding the hero in it needs no re-pose of hand-made weights (decision N-5). The dragon's and the crawler's are their standing poses. A figure is bound with every bone at identity in a pose whose limb directions are within 20 degrees of the reference; that small difference is the species' stance (the goblin's hunch, the giant's arms held wide), and because a rotation-only clip is relative to the bind pose, **the stance carries through every shared clip for free**. A figure that needs more stance than that gets a per-model stance offset in the motion table, added after the animator like Stage 4's offsets; none is built until a figure needs it. Monster bodies are modelled, weighted and bound in that spread pose, so no re-pose step exists. The chicken is exempt and posed in code (4.6).

What follows from them:

| Code that exists | What it does | With bones |
|---|---|---|
| `findPivot`, `getObjectByName` (`blenderMonsters.ts`, `blenderHero.ts`) | find a pivot by name | finds the bone; a `Bone` is an `Object3D` |
| `poseMonsterLimbs` (`monsterMeshes.ts`) | writes `rotation.x` / `.y` / `.z` on pivots | writes the same numbers on bones, same axes, and the skin bends instead of a rigid part turning |
| Stage 4's torso lean, knock-back offset and wind-up pose (its 6.5) | additive rotation on `Torso`, `HeadGroup`, arm or wing pivots; an offset on the figure's group | unchanged for figures posed in code; applied after the mixer for figures driven by clips (6.1.3) |
| Gear mounting (`playerMesh.ts` 195-373) | adds a rigid group under the elbow, knee, head, arm, leg or torso pivot at a fixed offset | adds it under the bone of the same name; the offset is today's plus the joint's move (old pivot rest position minus new bone rest position), so every piece sits where it sits today at the reference pose (measured: a rigid child of a bone lands exactly where the same offsets on a pivot chain land, 3.5 S15) |
| The hero's clip functions (`build_hero.py` 121-416) | key rotations per pivot name, with `Torso`, `HeadGroup`, the arms and the legs all siblings under the root, plus position keys that make the head and arms follow the torso | the same functions, **converted** for the chain: a child's rotation has its parent's removed, keyed in mode `XZY` or as quaternions, and the position keys handled as 6.1.5 says |

And one thing that did not exist before: **a rotation-only clip plays on any figure with the same bone names and a bind pose near the same reference, whatever its proportions, with no retargeting** (measured for proportions, 3.5 S4; the bind-pose bound of rule 3 is the design's answer to what S4 did not vary). That is what "reuse" rests on.

#### 6.1.2 Three skeletons serve everything

| Skeleton | Bones | Who stands on it | Where its clips live |
|---|---|---|---|
| **Biped** | 16: `Root`, `Hips`, `Torso`, `HeadGroup`; `LeftArmPivot`, `LeftElbowPivot`, `LeftHand` and the right three; `LeftLegPivot`, `LeftKneePivot`, `LeftFoot` and the right three. Optional: `Jaw`, `WeaponPivot`, `OffhandPivot`, `LWing`, `RWing`, `TailPivot`, `TailPivot2`; `LeftShoulder` and `RightShoulder` between `Torso` and the arm bones, added only if the hero's worst-pose sheet shows the deltoid collapsing with an arm raised (`Cast`, `Chop` and `Ranged` raise it 1.45 to 1.55 rad); no shared clip keys them | Hero, guards, merchants and every other townsperson (they are instances of the hero), goblin raider, goblin archer, dark wizard, dark ranger and Thornwatch Marksman, hill giant, moss guardian, lesser demon (with the wing and tail bones), chicken (wings on the arm bones, posed in code). Stage 6: camp captain, dungeon boss | `hero.glb`, authored on the hero |
| **Dragon** (winged quadruped) | 22: `Root`, `Hips`, `Torso`, `Neck1`, `Neck2`, `HeadGroup`, `Jaw`; front legs `LeftArmPivot`, `LeftElbowPivot` and the right two; hind legs `LeftLegPivot`, `LeftKneePivot` and the right two; `LWing`, `LWing2`, `RWing`, `RWing2`; `TailPivot`, `TailPivot2`, `TailPivot3` | Dragon, Ashmantle. Later: any four-legged beast, with the wing bones left out | `monsters.glb`, authored on the dragon |
| **Crawler** (many-legged) | 20: `Root`, `Hips`, `HeadGroup`; claws `LeftArmPivot`, `LeftElbowPivot` and the right two; `LeftLegPivot` and `RightLegPivot` (each still swings its whole side, as today), plus optional per-leg bones `LegL1` to `LegL4`, `LegR1` to `LegR4`; `TailPivot`, `TailPivot2`, `TailPivot3` | King scorpion, Saltback Stalker. Stage 6: the swarm creature | `monsters.glb`, authored on the scorpion |

Proportions are free: a skeleton fixes names and hierarchy, not lengths. The giant's shoulders are wider and the goblin's legs shorter on the same sixteen names.

**What reuse buys, concretely:**

- **One clip library per skeleton.** The biped library (the hero's ten clips plus `Death`, and `Hurt` if decision N-6 keeps it) animates the biped monster types except the chicken, and every townsperson. A goblin walks with `Walk`, swings with `Slash`, a ranger shoots with `Ranged`, a wizard casts with `Cast`, and each plays `Death`. That is eleven or twelve authored clips for about a dozen figures, where one clip set per figure would be over a hundred. A clip is about 1 to 4 kB on the wire (3.5 S9).
- **Shared attack and hit-reaction motion.** Stage 4's wind-up pose becomes the attack clip's own anticipation, held (6.1.3), so the telegraph and the strike are one motion.
- **Kits.** A variant is a base figure plus rigid pieces on its bones (5.6).
- **Future monsters cost a mesh and a data row.** Stage 6's captain and dungeon boss arrive on the biped rig already able to walk, swing, flinch and fall; the swarm creature arrives on the crawler rig.
- **One gear system for every biped.** The guards wear the player's armour through the player's own mounting code (10.3); any biped monster could hold a real weapon from `gear.glb` later.

What reuse does **not** buy: a creature whose skeleton differs (a snake, a bat) needs a fourth rig and its own clips.

#### 6.1.3 The engine side (three 0.169)

| Concern | Today | With skinned figures | Evidence |
|---|---|---|---|
| Clone | `template.clone(true)` | `SkeletonUtils.clone` (three's own `examples/jsm/utils/SkeletonUtils.js`; no new dependency). After the clone the engine strips the node's own prefix from bone names (the key in `Monster_<key>`: the model key, or the `body` key for Ashmantle, whose bones are `ashmantle_<Bone>`), so every instance has canonical bone names. **Clip tracks carry the same prefix** (`elvarg_dragon_HeadGroup.quaternion`), so a library loaded from `monsters.glb` is stripped once per library, when it is cached, with the prefix of the figure that authored it. The per-instance `mesh.geometry = mesh.geometry.clone()` stays: projected UVs and the albedo phase are written per instance, and disposal frees the instance's own geometry. The clones share one `boneInverses` array with the template (S17), so nothing may ever call `skeleton.calculateInverses()` or `bind()` without the mesh's `bindMatrix`. | S5: `clone(true)` leaves the copy bound to the original's bones. S11, S15, S17. |
| Both kinds at once | | The loader branches on what it finds: a node with a `SkinnedMesh` under it takes the skinned path, any other the rigid path. A figure migrates by promoting its file; no flag, no list. | 6.1.5 |
| Materials by name | one material per mesh, chosen by material-name family | unchanged; a skinned figure has **one skinned mesh per material family** (hide or skin, cloth, hard, glow, eyes), not one per part | 6.4 |
| Banded light | `facetMaterial` patches the Lambert shader in `onBeforeCompile` | Today's patch writes its normal after `beginnormal_vertex`, **before** three applies the skin, so bands would be lit from the bind pose (measured). Stage 5's model (its 6.1) deletes that patch and bands inside `RE_Direct_Lambert`, using three's own normal, which is skinned: correct by construction. R0 (2026-11-25) confirmed Stage 5's model landed: no custom normal varying is written (`materials.ts` 271-283; `tests/facet-light.test.ts` 70 asserts `vCelNormal` is gone), so `facetMaterial` needs no change for skinning. Its one vertex varying, `vFootHeight = transformed.y` after `begin_vertex`, is read before `skinning_vertex` and so is the bind-pose height; no figure sets `footHeight` (only `blenderWorld.ts` and `flora.ts` do), and a skinned figure must keep `footHeight` 0. Three compiles a separate program for skinned use of the same material (`WebGLPrograms.js` 311), so one material instance can serve both. | S7 |
| Vertex colour, albedo tiles | `vertexColors`, projected UVs written per instance | unchanged: both are per-vertex data that travel with the skin. The projection uses rest-pose positions. | |
| Outline shell | a plain `Mesh` sharing the geometry, with a raw `ShaderMaterial` | For a `SkinnedMesh` the shell is a `SkinnedMesh` bound to the **same skeleton** with the mesh's bind matrix (`shell.bind(mesh.skeleton, mesh.bindMatrix)`, never `bind(skeleton)` alone: that recomputes the shared inverses at the current pose and corrupts every instance, S17; `addCartoonOutline` runs again on every gear change, mid-animation). The outline material gets a skinned variant whose vertex shader includes three's four skinning chunks. Plain meshes keep today's shell, so the three frozen tests that read a shell stay green. | S5, S7: as written the outline stays in the bind pose; S17 |
| Frustum culling | geometry bounding sphere | Frustum culling of a `SkinnedMesh` reads the **object's** `boundingSphere`, not the geometry's (`Frustum.intersectsObject`, three 0.169), so today's shell code, which inflates the geometry's sphere, does nothing for a skinned shell. Each skinned mesh gets a **fixed** sphere: the rest-pose sphere with its radius times 1.5 (covers a raised weapon and a fall), set once on the template so every clone copies it (`SkinnedMesh.copy` clones it, S17); a skinned shell gets its mesh's sphere plus the outline margin. Never recomputed per frame. | S6: three computes the sphere once and never refreshes it |
| Clicks | `intersectObjects(G.worldInteractiveObjects, false)` on invisible hitboxes (`input.ts` 207, 249, 381; `spawns.ts` 75) | **unchanged.** No ray is ever cast at a figure's mesh. | read in the code; S6 shows a skinned raycast works but costs 9 ms |
| Shadows | every mesh casts | unchanged; three's depth material applies the skin itself (`depth.glsl.js` includes the skinning chunks). One shadow call per skinned mesh. | S8 counts both passes |
| Disposal | `disposeObject3D` frees geometries and materials | also calls `skeleton.dispose()` for each skinned mesh (it frees the bone texture). Monsters respawn, so this is not optional. | `Skeleton.dispose` exists; the bone texture is created on first render |
| Hero animation | `BlenderHeroAnimator`: an `AnimationMixer` over clips that target pivots by name | **unchanged class.** The clips target bones of the same names. | S5 |
| Monster animation | `poseMonsterLimbs` writes pivots every frame | First: unchanged, on bones (the pilot proves it). Then, for biped monsters, the same animator class as the hero, fed the hero file's clips (6.5). Dragon-rig and crawler-rig figures get the same once their libraries exist. | S4 |
| Stage 4's reactions | flinch and wind-up overwrite pivots and the group's y and x rotation and return early (`monsterMeshes.ts` 818-843); knock-back offsets every child of `rig.group` except the hitbox, never the group (`reactions.ts` 161-186); for the hero, knock-back writes `meshGroup.position` after the loop's copy (`reactions.ts` 152-159); hit stop zeroes `animDt` (monsters `monsterMeshes.ts` 816; hero `loop.ts` 426) | For figures still posed in code: unchanged. For figures driven by clips: (1) lean, flinch and knock-back are **added after `mixer.update`**, the way Stage 4 already leans the hero's torso without interrupting a swing; (2) hit stop is the animator skipping its update for the frozen time; (3) the **wind-up pose is the attack clip itself**, paused and scrubbed from its start to its anticipation key by wind-up progress, then released on the strike. The manifest records each attack clip's anticipation time. The named place: for the hero, `updateReactions` (`reactions.ts` 285), which `loop.ts` 958 already runs after `updatePlayerAnimation` (`mixer.update` at `blenderHero.ts` 125); for a clip-driven monster, the animator update replaces the `poseMonsterLimbs` call at `loop.ts` 741-773, and the flinch is then written as an additive offset after it in the same place, because today's flinch overwrites and returns; the wing flap at `loop.ts` 726-729 is skipped for clip-driven rows. | Stage 4 design 6.5; R0 item 11 |
| Per-frame cost | 22 to 68 matrices and draw calls per monster | 16 to 22 bone matrices and one small bone texture per figure, updated once per frame per skeleton (`WebGLObjects.js` 52 calls `skeleton.update()` once per frame) and uploaded as one small texture (`WebGLRenderer.js` 2056-2058 creates and binds `boneTexture`); three 0.169 always uses a bone texture, so there is no uniform bone limit; the depth material includes the skinning chunks (`depth.glsl.js` 7, 35), so shadows follow the pose; the skinned variant is a separate program keyed by `parameters.skinning` (`WebGLPrograms.js` 311); 2 to 4 draw calls per pass | 6.4 |
| Placeholder rigs | `buildHumanoidRig` and the procedural monster builders show until the GLB resolves, or if it fails | unchanged; they stay rigid. They are the fallback, not the figure. | `lean-rig.test.ts` stays green |

#### 6.1.4 Gear on a skinned hero

**Rigid pieces attached to bones** is the standard technique for armour and weapons, and it is what the game already does with pivots. Every piece of `gear.glb` stays a rigid group mounted on the bone that has its pivot's name: weapon, ring and gloves on the elbow bones, boots on the knee bones, helm on `HeadGroup`, body pieces on `Torso` and the arm bones, leg pieces on `Torso` and the leg bones. `gear.glb`'s node names and mount spaces do not change. What changes for the eye: the body under the armour now bends at elbow and knee, and the rigid pieces overlap at the joint as plate does.

**Every hero mount offset moves, by arithmetic, in one place** (second pass). The bones sit at the author's joints (S14), not at `LEAN_RIG`'s pivots: shoulders 0.10 inward, hips 0.11 up, knees 0.08 up, elbows a few centimetres, and `HeadGroup` from the top of the head (1.86) to the author's `neck` joint (1.50; the `head` bone is at 1.59), because a skinned head must turn about the neck. Each offset becomes today's offset plus (today's pivot rest position minus the new bone rest position), both taken with every pivot and bone at identity rotation, inside the one mounting function that the player, the merchants and the guards share (10.3). Rest rotations are identity on both sides and the bind pose is the source's A-pose that today's mesh already has (6.1.1 rule 3), so no piece needs a new rotation, and every piece sits exactly where it sits today at the reference pose; under motion it now turns about the true joint. A test pins every piece's transform in the figure's space at the reference pose to today's (8.3).

**Hiding body parts under armour** stays by name, and the names stay: `Hair` is a rigid mesh on the head bone (hair on this figure does not need to bend); `TorsoCoat` and `InnerCollar` are their own skinned meshes. A skinned mesh hangs under the figure's root, not under a bone, so the two hide loops (`playerMesh.ts` 230-242, 259-272) search the figure's group instead of the head and torso pivots: a one-line change each, covered by a test. The hero is therefore **not one draw call**: it is about eleven meshes (head, hair, eyes, inner shirt, coat, belt, sleeves, bracers, hands, legs, boots) where it is eighteen today, because the engine recolours five of its materials when armour is worn (`tunicMat`, `legsMat`, `bootMat`, `gloveMat`, `bracerMat`) and hides two by name.

**Which gear should itself be skinned, and what that costs.** Pieces that span a joint or hang as cloth look stiff when rigid: the robe skirt (`robe-skirt`), capes, trousers and chaps across the knee, long sleeves. A skinned gear piece must be authored against the hero's skeleton, exported with weights, cloned with the skeleton utility and **bound to the wearer's skeleton at mount time** instead of being added under one bone; its outline shell and culling sphere follow the rules above; and `gear.glb` must then carry a copy of the biped armature. That is a second mounting path and new weights for each such piece. **None of it is in this stage**: every gear piece stays rigid, exactly as mounted today, and skinned gear is the first item of the follow-up stage (section 10).

#### 6.1.5 Migration without a big bang

The game works after every step, because the loader takes the skinned path only for a figure whose file carries a skin.

| Step | What moves | The game after it |
|---|---|---|
| 1 | **The pilot: the goblin raider**, rebuilt and skinned, posed by today's `poseMonsterLimbs` on its bones. The engine gains the skinned path (clone, outline, culling sphere, disposal), with every other figure untouched. | One skinned monster among rigid ones. If the owner rejects the approach here, one figure and one engine branch are reverted. |
| 2 | **The hero**, with its author's weights, its clips re-authored on bones, gear mounted on bones. Merchants and the other townspeople follow automatically (they are the hero's file). **Guards** become two dressed instances. | Every human in town is skinned; the biped clip library exists. |
| 3 | **Monsters driven by clips**: the pilot goblin switches from code poses to the hero file's clips. Then **dragon, Ashmantle, demon**: new models on the dragon and biped rigs. | Reuse is visible; the bosses move for the first time. |
| 4 | **Remaining monsters** are rebuilt or re-rigged group by group; each biped arrives already driven by the shared clips. | Fewer rigid figures at each promotion. |
| 5 | When the last rigid monster is gone, the rigid branch of `upgradeMonsterRigWithGltf` is deleted. | One path. |

**The hero's ten clips are re-authored on the rig by the code that already writes them, with one conversion.** The sample functions of `build_hero.py` return a rotation per pivot name, in three's axes, which `build_action` turns into Blender `XYZ` Euler on empties through `t2b_euler`. Today `Torso`, `HeadGroup` and the arm and leg pivots are siblings under the root, so those rotations are all in the figure's own space, and the functions add position keys so the head and arms follow a torso that bobs or lunges (18 `pos` entries). Under the chain, the head and arms are children of `Torso` and the legs of `Hips`. So the builder converts instead of copying, as quaternions (S16: a bone keyed in mode `XZY` with the sample function's own numbers equals today's pivot; mode `XYZ` does not):

1. **Rotations.** For `HeadGroup` and the arm bones, local = inverse of the torso's quaternion of that frame times today's quaternion, which keeps each bone's orientation in the figure's space as today. Elbows, knees and legs are already relative to their parents. **Exception: `SpinSlash`**, whose torso yaws 4π while the arms stay fixed in the figure's space: converted that way the arms would point one way while the shoulders orbit the spine, through the chest. In `SpinSlash` the **arm bones** keep today's numbers as **local** rotations (they spin with the torso, which is what a spin attack shows), and the orientation check skips them for that clip. The head is converted normally (its shipped yaw is 0.85 of the torso's; kept local it would turn 3.4π on top of the torso's).
2. **Positions.** Today's position keys are of three kinds: the legs' `pos` (only `Walk`'s dip and `Idle`'s zero), the torso's (`Idle` sway and bob up to 8 mm, `Walk` sway and dip, `Lunge` 0.06 down and 0.16 forward, `Cast` 0.04 up), and the head's and arms' follow-the-torso keys. Only the legs' keys become the `Hips` track (the one shared position track, scaled by each figure's hip height): moving the torso's keys to `Hips` would carry the legs, sinking the feet 6 cm into the ground and sliding them 16 cm in `Lunge` and lifting them 4 cm in `Cast`. The torso's own translation is dropped (the chain has no position track on `Torso`, because shared clips are rotation-only); `Lunge`'s forward thrust is re-authored in H4 as hip and torso pitch with the wind-back it lacks. The follow-the-torso keys are dropped, because the chain does that now.
3. **Check.** Mechanical, against the shipped file (plan H3a): at sampled frames of every clip, each bone's orientation in the figure's space equals the shipped pivot's within 0.02 rad (except `SpinSlash`'s arms); **and** each leg bone's (`LeftLegPivot`, `RightLegPivot`) displacement from its rest position, in the figure's space, equals the shipped leg pivot's displacement from rest within 0.01 (a foot's own height changes with every leg rotation, so it is not the invariant; the leg root's is: no `Hips` key may move the legs where today's legs did not move).

What does change, on purpose: when the torso turns, the shoulders now travel with it instead of staying in place, and elbows and knees bend the skin. The clips are not retargeted from anywhere.

**The hierarchy changes, and one frozen test reads it.** Today the hero's pivots are siblings under `HeroRoot`; a skeleton needs a real chain (`Root`, `Hips`, `Torso`, then head and arms; legs under `Hips`), so that a lean of the torso carries the arms and the head. Section 8.3 declares the two assertions this replaces.

#### 6.1.6 Authoring without an interface: what a script can do, and where it stops

Everything is built by `blender --background`. Measured in 3.5:

| Step | By script | Quality |
|---|---|---|
| Skeleton | A table of bone names, parents and joint positions per figure; bones created pointing up, roll 0 | Exact (S1) |
| Body mesh | Stick graph, skin modifier, voxel remesh, smooth, decimate; hard parts (weapons, plates, horns, hats) built from primitives as today | A continuous, manifold body in seconds (S2). Its form is as good as its stick graph and radii: fine for limbs and torsos, weak for faces, hands and anything that needs edge flow |
| Weights, organic parts | Blender's automatic weights against a limb-aligned twin of the armature, in a spread pose, then re-bound to the world-aligned rig | 0 unweighted vertices, 4 influences at most, clean bends through a walk and a strike; a pinch at a knee bent 90 degrees (S2). Good enough for creatures seen at 70 to 500 px |
| Weights, hard parts | Assigned by construction: each rigid part gets weight 1 on its bone (a club on the hand, a plate on the torso) | Exact; this is also how the scorpion and the guardian are "kept" |
| Weights, third-party sources | Folded from the author's own vertex groups onto the shared rig's bones | Hand-made quality, for the hero (S13) and, as a fallback, for the demon |
| Clips | Pose tables sampled per frame onto pose bones, one NLA track per clip, exported rotation-only | Smooth, shared, deterministic (S3, S4) |
| Fallback when automatic weights fail | Weights from the distance to each limb segment, scaled by the limb's radius, blended across the two nearest (written for the probe, not needed there) | Coarser; never leaves a vertex unweighted |

**Where a person or a third-party rigged source is needed.** Automatic weights cannot be told that a cloak hangs from the shoulders, that a skirt belongs to the hips and not the legs, or that a jaw must not drag the neck; those are written as rules per figure (a height band, a named part) and judged on the worst-pose sheet. Fingers and faces are out of reach: hands are mittens weighted to one bone, faces are rigid with the head. If a figure's deformation still fails the owner's look after two attempts, the fallback is a rigged CC0 or CC-BY model whose weights are folded onto the shared rig, as S13 did for the hero (6.2 item 3). The dragon is the figure most likely to need it: a scripted wing membrane and neck are the hardest shapes here.

### 6.2 Where meshes come from (CALL-M8, decided 2026-11-14)

1. **Procedural Python builders are the default**: reviewable as a diff, repeatable, original, no licence. Every rebuilt monster, the new dragon, Ashmantle, all gear and all kit pieces are procedural.
2. **The hero keeps its third-party body** (CC-BY 3.0), now with its author's armature weights folded onto the biped rig instead of being cut into eighteen rigid parts.
3. **A third-party rigged model** (owner, 2026-11-14: allowed as a source) is used only when a procedural attempt has failed the owner's look, and only if its licence is CC0 or CC-BY (any version), with the licence file committed beside it and a `CREDITS.md` row. Never non-commercial, no-derivatives, "editorial", "free for personal use" or unstated. One owner sign-off per asset. Its mesh and weights are kept; its skeleton is replaced by the shared rig.
4. Sculpting and weight painting by hand are not available here (no interface). Everything must be producible by `blender --background`.

New builder code goes in one new module, `scripts/blender/figkit.py`, imported by the build scripts: `make_rig` (a skeleton from a table), `organic_body` (stick graph to skin), `auto_weights` with the segment fallback, `hard_weights` (a rigid part onto one bone), `fold_weights` (a source's groups onto the rig's bones), `merge_by_family` (one skinned mesh per material family, toggled names kept apart), `bake_paint`, `make_clip`, `export_glb`. For the pilot the body is built two ways (plan S2): (a) the skin-modifier route of 3.5; (b) today's primitives fused by a voxel remesh. The owner picks after seeing both in the game. The helper functions duplicated across the three large scripts are left as they are; moving 9,500 lines is not this stage.

### 6.3 Colour: named materials plus vertex colour, no textures

- Materials keep their names; the engine keeps choosing the surface by name (K2).
- The builder bakes the layer of 5.4 into `COLOR_0` with Cycles on the CPU (measured, 3.3: it works headless and takes seconds; the critique's E7 found two bakes byte-identical). The exporter writes `COLOR_0` as normalised 16-bit, 8 bytes per vertex, even from a byte attribute. It is baked to the `POINT` domain, so it splits no vertex. **`TEXCOORD_0` is dropped from figure exports** (8 bytes per vertex, read by nothing: K2). That saves raw bytes (parse time, memory) but little on the wire for box-built figures: on the goblin, 121,155 to 117,629 (3%), while the AO bake adds 121,155 to 148,323 (22%) (critique E11). Today's procedural meshes carry about 1.8 vertices per triangle (split normals on every box edge) and compress about 7:1; reworked organic figures carry under 1 but compress like the hero (about 1.6:1), so their wire size is measured, not assumed (critique H5): 3.5 S9 measured a probe body, and the pilot measures the first real figure (plan S2).
- **One small engine change**, after Stage 5's light model: the three upgrade functions pass `vertexColors: true` when the cloned geometry has a `color` attribute. `COLOR_0` is **all or nothing per file** (a manifest rule), so the hero sets the flag on its shared role materials (`rig.tunicMat` and the rest, which `playerMesh.ts` recolours) and never splits a material into two instances. A file without the attribute renders exactly as today, so files can be promoted one at a time. The change lands in slice 0, before the slices fork.
- A skinned figure adds two attributes per vertex: `JOINTS_0` (4 bytes) and `WEIGHTS_0` (16 bytes as floats). Measured (3.5 S9): about 6.3 bytes per vertex on the wire. Organic bodies compress about 1.1:1, so the figures of this stage are heavier per triangle than today's box figures; section 9 budgets for it, and decision N-3 offers 8-bit normals, weights and colour, which need no decoder.
- No image is embedded (K3) and none is added to `public/`.

### 6.4 Draw calls: one skinned mesh per material family

A skinned figure does not need a mesh per moving part: the skeleton moves the parts. The builder's `merge_by_family` joins everything that shares an **engine material family** (the name rules of `blenderMonsters.ts` 110-145: glowing, eyes, hide or skin, cloth, leather, wood, bark, moss, stone, metal, plain) and an outline flag into one skinned mesh; rigid accessories (a club, a shield, a hat) are part of that mesh with weight 1 on their bone. It never merges across a name the engine toggles (8.1). Stage 5's `mergeByMaterial` (`batching.ts` 20) runs on `world.glb` only, and it drops every attribute but position, normal and uv (`batching.ts` 53-57), so figure merging stays build-time (`merge_parts`, `merge_by_family`) and never calls it (R0 item 3).

| | Today | Merge-only pass (plan M0) | Skinned |
|---|---|---|---|
| Goblin raider | 59 meshes | 29 (measured, 3.3) | **at most 4, target 3**. Leather and wood are two engine families (`blenderMonsters.ts` 127-130) and eyes are a separate unlit `MeshBasicMaterial`, so the target holds only if the builder authors to it: skin, one secondary family for shield, straps and shaft, metal; eyes painted into the skin's vertex colour instead of a mesh named `eye`. Today's material set would give 5 or 6 |
| A camp of seven goblins, per pass | 413 | 203 | 21 to 28 |
| The same camp, colour and shadow pass | 826 (measured, 3.5 S8) | 406 | 42 to 56 (42 measured for seven figures of three) |
| Every monster of Stage 4's roster (42), per pass, if all were in view | about 1,700 | about 850 | at most 170 |
| Dragon | 5 | 5 | 3 (hide, horn and claw, glow) |
| Hero, undressed | 18 | | about 11 (6.1.4) |
| Hero in a full plate set | 62 | 32 after the gear merge | about 32: 11 of body, about 21 of gear |
| One guard | 27 (the knight) | | **about 26** (second-pass recount from `gear.glb`): 11 of body, and after the gear merge the guard's pieces hold `Gear_helm` 5 families, `Gear_plate-body_torso`, `Gear_platelegs_legL`, `Gear_platelegs_legR`, `Gear_kiteshield` and `Gear_sword` 2 each (the plate body has no arm nodes in `gear.glb`), so 11 + 5 + 2 × 5 = 26 per pass, about what the knight costs. A cheaper design exists (merge each guard's fixed loadout per family at load, about 13 calls) and is not worth a second code path for two figures |

**Can a figure be one draw call?** Yes: one material, with every colour in the vertex-colour layer (which the owner approved as the paint layer). Seven such figures were 14 calls a frame with shadows in the probe. The price is the engine's surface families: one material means one albedo tile and one side setting for the whole figure, so cloth, hide and metal stop answering light differently (5.4). The design takes **up to three families** per ordinary monster and leaves one-material figures for crowds (the Stage 6 swarm creature). The owner sees both on the pilot (decision N-4).

**Against the owner's 51 FPS on an RTX 4070.** That frame is probably bound by the CPU cost of draw calls, not by the GPU, but nobody has measured it. The numbers above say how large the lever is: a fight at a goblin camp drops by about 770 calls a frame, which is of the order of Stage 5's whole start-pose budget (at most 1,000 colour-pass calls on Medium, its section 10). The start pose itself changes little: the two guards cost about what the two knights cost (about 26 against 27 each), the hero a few fewer. Whether calls are what binds is tested **before** any skinning lands, by the merge-only pass.

**The early merge-only pass stays** (critique M10, D-5). It joins meshes that share pivot, material, outline flag and name class in every monster builder, changes no shape, needs no engine change, and is promoted right after slice 0. It is thrown away figure by figure as monsters are rebuilt, and it is still worth its two tasks: it is the cheapest experiment that tells the owner whether halving monster draw calls moves the frame rate on the real machine. If it does not, draw calls are not the bottleneck, and skinning is then justified by look and reuse alone; the stage's order does not change, but nobody should promise frame rate. A test proves the engine classifies the same triangles into the same material families before and after, and the promotion is judged on an in-engine capture, because merging changes how the engine's projected albedo tiles fall on small parts (`assignProjectedUvs` stretches each geometry's span to 1, `textures.ts` 287-303). The same holds for every skinned figure, whose families are merged from the start.

### 6.5 Animation: smooth clips, one library per skeleton

Clips are authored as code: a clip is a short pose table (pose name, frame on a twelve-a-second grid, easing), sampled per frame onto pose bones and exported rotation-only (6.1.5, 3.5 S3). Review is by frame strip (7.3) and in the game.

**The biped library**, authored on the hero, in `hero.glb`:

| Clip | Source | Used by |
|---|---|---|
| `Idle`, `Walk` | today's functions, improved where measured weak (`Idle` 0.02 to 0.06 rad on every pivot; torso in `Walk` 0.04 rad), with knee and elbow bends added | every biped |
| `Slash`, `Lunge`, `SpinSlash` | today's; `Lunge` gains the wind-back it lacks (critique E12) | hero; melee monsters use `Slash` |
| `Ranged`, `Cast` | today's; `Cast` gains torso lead (0.12 rad today) | hero; archer, ranger, marksman; wizard |
| `Chop`, `Mine`, `Fish` | today's; `Fish` gains arm motion (0.10 rad today) | hero |
| `Death` (new; owner: "ok", 2026-11-14) | 1.1 s, ends lying, last pose held | hero (today it stands upright behind the death overlay, `handlePlayerDeath`, `actions.ts` 544); biped, dragon and crawler monsters play it at a time scale of 1.1 / 0.85, about 1.3, so it ends within `DYING_SECS` (0.85 s, `monsterAi.ts` 98); the figure is hidden when `dead` begins (`loop.ts` 709-712), so the held last pose is never seen on monsters; for a row with a `Death` clip, `poseMonsterDying`'s group topple (`monsterMeshes.ts` 801-808) is skipped and only its sink, or nothing, is kept, so the fall is not drawn twice |
| `Hurt` (new; **owner decision N-6**, not asked for) | 0.35 s: arms and head recoil, knees give | Proposed as a shared hit-reaction clip in the spirit of answer 1's reuse; built only if N-6 says yes. On the hero it plays under Stage 4's lean only when no attack or skill clip is running, and never interrupts a swing. On monsters it is optional per figure; Stage 4's flinch numbers keep working without it. |

Two constraints come from the frozen test (`blender-hero.test.ts` 63-70): 0.2 s into `Walk` a leg bone has turned more than 0.01 rad on x, and 0.15 s into `Slash` at 1.2 speed the right arm has turned more than 0.05 rad on x. So "the arm arrives last" means the arm starts its wind-back at once, in the anticipation, and the torso leads the strike; both samples go into the manifest. Clip lengths stay within 10% of today's so `playAction` time scales still fit.

**The dragon library**, authored on the dragon, in `monsters.glb`: `Idle`, `Walk`, `Bite`, `WingBuffet` (the raised pose Stage 4's wind-up shows today, now a motion), `Death` (played within `DYING_SECS`, as the biped `Death` row says), and `Hurt` if N-6 says yes. Five or six clips for two bosses.

**The crawler library**, authored on the scorpion: `Idle`, `Walk`, `Strike`, `Death` (played within `DYING_SECS`, as the biped `Death` row says), and `Hurt` if N-6 says yes. Four or five clips for two monsters and Stage 6's swarm.

**Walk speed on other legs.** The hero's animator scales `Walk` by the hero's speed ratio; a figure with shorter legs moving at the same speed would slide its feet. The monster animator therefore also multiplies `Walk`'s time scale by the hero's leg length over the figure's (hip height to sole), one number per model key, cached with the scaled `Hips` track.

**How monsters get there.** The pilot and every figure promoted before its library exists are posed by `poseMonsterLimbs`, unchanged, on bones. The `if (model === ...)` chain (`monsterMeshes.ts` 848-880, keyed on `m.def.model ?? m.typeKey` at 851) becomes a small data table per model key (plan M1b): which clips a model uses for idle, walk, attack and death, or, while it is still posed in code, today's numbers. A model whose row names clips gets an animator (the hero's class) and stops being posed in code. Rigid figures and code-posed skinned figures can coexist with clip-driven ones for as long as the migration lasts.

Per-species idle traits and second attack clips are not in this stage. A boss that needs a move of its own in Stage 6 adds one clip to its rig's library.

### 6.6 Level of detail: none in this stage (cut by the critique, M7)

A second mesh per figure would add about a third to the bytes. The detail layer first proposed here (small parts tagged `extras.detail`, merged into separate meshes, hidden under about 110 px) was cut: it **adds** draw calls up close as many as it removes at distance, saves only triangles, which Stage 5 argues are cheap here (its 6.6, 6.7; no real-GPU frame time exists yet), and costs a tag in every builder, an engine module, a tier row and two tasks. The rule that stays for builders: **the whole figure must pass the 85 px silhouette read.** If a figure needs fewer calls at distance later, three's `BatchedMesh` or a per-figure merge at load are the next steps, not a layer.

---

## 7. The safe pipeline and the review loop

These are the first tasks of the plan. No model changes before both exist.

### 7.1 Build never writes into the shipped folders

- One new module, `scripts/blender/paths.py`, gives every script its output paths. The output directory comes from `-- --out <dir>` and defaults to `scratch/models-build/` (`scratch/` is already git-ignored). It **refuses** a directory inside `public/` or `blender/`. The Kai zip is extracted under the output directory, each member's path checked to stay inside it. The hero script stops rendering a preview during a build.
- `run-blender.mjs` accepts `--out <dir>` and passes it through after `--`. `all` still spawns exactly four builds and the flag order is unchanged, so `tests/run-blender.test.ts` stays green untouched. The guard script gets a mode name. `export` (re-export of an edited `.blend`) writes `<out>/<target>.glb`; today `export_from_blend.py` writes `public/models/hero.glb` whatever its input.
- Every other write target is closed too: the `-- --render <path>` preview option of `build_gear.py`, `build_monsters.py` and `build_world.py` goes through the same refusal; the hero's preview render is removed.
- `--disable-autoexec` and `--python-exit-code 1` stay on every call (third-party `.blend` files are untrusted input), and `--factory-startup` is **added** (the runner does not pass it today).
- The pipeline is **local only**: CI (`.github/workflows/ci.yml`) has no Blender. CI checks what is shipped: the manifest, licence, cache-key and path-leak tests run in `npm test`.

### 7.2 Compare, then promote on purpose

`scripts/models-compare.mjs <built.glb> <shipped.glb>` is plain node (it reads the GLB JSON chunk and buffers; no dependency). It prints and writes a report in three parts:

| Part | Checks | A difference means |
|---|---|---|
| **Contract** | The **built file against the manifest** (which the same task updates): node names and parents; pivot or bone translations within 0.0001 of the manifest; scales; material names; mesh name classes and the toggled names of 8.1; mount-relevant part centres within 0.01; `extras`; clip names; that each clip still moves the pivots or bones the tests read; `COLOR_0` all or none. **For a skinned figure also**: the bone list and parents of its skeleton (6.1.2); every joint's rest rotation is identity; every vertex has at most 4 influences, weights that sum to 1 within 0.01 and joint indices inside the skin; the skinned root node (`Monster_<key>`, `Kit_<name>`, `HeroRoot`) has no translation, rotation or scale (6.1.1 rule 2b); shared clips hold rotation tracks only, plus `Hips` position; each attack clip's anticipation time. | **Stop.** A contract changes only together with its manifest and its test in the same commit. |
| **Budget** | Triangles, meshes and materials per figure; raw bytes; Brotli quality 3 bytes; per figure and per file and total, against the manifest's ceilings. | **Stop** if over. |
| **Drift** | The **built file against the shipped file**: every node, pivot, bound, geometry hash and the generator string. | Information for the reviewer. An unchanged rebuild shows zero Drift apart from the generator string (critique E2: the hero's binary chunk is identical). |

The contract is a committed manifest, **one file per GLB** (`tests/fixtures/model-contract/<file>.json`, so parallel slices never edit the same file), generated once from today's shipped files and edited only by tasks that declare the change. A change made before its file is promoted is written to a pending copy (`model-contract/pending/<file>.json`), which the compare uses and the promotion moves into place, so the shipped files always match the live manifest. `tests/model-contract.test.ts` checks the shipped GLBs against it on every test run, with no Blender.

`scripts/models-promote.mjs <name> --yes` copies **one named file** from the build directory to `public/models/` (and its `.blend`, CALL-M10) only if the compare passes Contract and Budget, and prints the new hash. The loader's `?v=` key for that file is then set to the first eight hex digits of the file's SHA-256, and a test keeps the two equal, so a changed model can never be served from an old cache entry. A rebuild that changes nothing is never promoted.

Which Blender builds the shipped file is not fixed: the comparison is structural and the manifest is the truth (CALL-M9).

### 7.3 Looking: the review loop

`scripts/blender/review_render.py` imports a GLB (built or shipped) and renders, with Cycles on the CPU, for every figure:

| Sheet | Content | Proves |
|---|---|---|
| Turnaround | Front three-quarter, side, back three-quarter, 512 px | Form, proportion, joints |
| Silhouette | The same three views in flat black on white | The 85 px read; species told apart on one roster sheet |
| Play distance | Crops of a 1080-line frame at distances 5.4, 8.5 and 26, at in-game scale, with the pixel height printed | What survives at play size |
| Motion | Six frames per clip in a strip (hero), or the pose table's poses (monsters). **Each pivot's or armature's active action is cleared before one clip's track is unmuted**; otherwise the importer's `Idle` overrides every clip (critique C2; the probe of 3.5 hit the same trap with NLA tracks overriding a hand-set pose). The sheet prints, per clip, the measured rotation range of each bone. A **worst-pose sheet** per skinned figure (deep crouch, arm overhead, full twist) shows what the weights do at the limits. | Anticipation, strike, follow-through; how the skin bends, pinches or tears in the worst pose |
| Before and after | The shipped and the built figure side by side, same camera | The change |

Sheets are JPEG, committed under `docs/superpowers/baseline/models/<slice>/`, at most 2 MB per slice.

**Hero colours in sheets.** The engine sets every hero colour in code, so sheets of the hero use an engine-palette mode that maps `extras.part` to the colours of `blenderHero.ts` 182-197. Monster and gear sheets use the GLB base colours, as the engine does.

**In-engine capture.** Stage 5's capture procedure (`docs/superpowers/baseline/stage5/capture.md`) driving `window.__DEBUG.look` (`photo.ts`), with this stage's own pose file `docs/superpowers/baseline/models/poses.json`, with four model poses: hero close, hero at reset distance, the two guards, and one camp per slice. Taken before each slice, at the end of **every art task** from a throw-away worktree with the built file copied over the shipped one (so the owner sees the figure in the game before anything is promoted), and after each promotion.

**What a render can prove**: silhouette, proportion, relative size, pixel size at distance, joint gaps, pose and motion arcs, triangle density. **What it cannot**: colour and material as the game draws them (the engine replaces every material and re-projects UVs), the banded light, the outline, shadows on the world, speed, the blend between clips, how a hit feels. Those need the in-engine capture, and the capture here is from a software renderer, so **the owner's look on a real GPU is the acceptance of every slice**.

---

## 8. Contracts

### 8.1 What the engine looks up today

| File | Contract | Where |
|---|---|---|
| hero | Root `HeroRoot`; pivots `Torso`, `HeadGroup`, `LeftArmPivot`, `RightArmPivot`, `LeftElbowPivot`, `RightElbowPivot`, `LeftLegPivot`, `RightLegPivot`, `LeftKneePivot`, `RightKneePivot` | `blenderHero.ts` 157-168 |
| | Pivot rest positions equal `LEAN_RIG` (torso 1.24, head 1.86, shoulders 0.28 and 1.5, hips 0.11 and 0.9) | `blender-hero.test.ts` 56-61; `humanoid.ts` 6-28 |
| | `extras.part` values and mesh name prefixes that choose the material and the outline flag | `blenderHero.ts` 205-275 |
| | Clip names `Idle`, `Walk`, `Slash`, `Lunge`, `Ranged`, `Cast`, `Chop`, `Mine`, `Fish`, `SpinSlash`; `Walk` turns the leg pivots, `Slash` the right arm | `blenderHero.ts` 8-18; test 39-42, 63-70 |
| | No mesh named like worn gear | test 49 |
| | **Mesh names the engine hides by**: `Hair*`, `CrownSpike_*`, `BackSpike_*`, `Sideburn_*` under a helm; `TorsoCoat`, `OuterCoat_*`, `CoatTrim_*`, `CoatTail_*`, `CoatTailTrim_*`, `InnerCollar` under body armour. Today's file has `Hair`, `TorsoCoat`, `InnerChest`. | `playerMesh.ts` 235-268 (added by the critique, C3) |
| | **Mount geometry**: weapon and ring at (0.19, -0.32, 0.08) on the right elbow pivot, weapon rotated (-0.2, 0, 0.1); gloves at (±0.18, 0.32, 0.08) on the elbow pivots; shield on the left elbow pivot at (-0.19, -0.31, 0.08) for a defender, else at (-0.20, -0.22, 0.08) rotated -π/2 on y; boots at (-0.11 or 0.085, 0.38, -0.01) on the knee pivots; helm at scale 0.74, position (0, -0.16, 0.01) on `HeadGroup`; amulet at (0, -0.16, -0.04) and cape at (0, 0.12, 0.02) (ava) or (0, 0.22, 0.02) on `Torso`; body and legs pieces at the origin of `Torso`, the arm pivots and the leg pivots. The hero's hand, foot and head centres must stay within 0.01 of today's so these still fit. | `playerMesh.ts` 195-373 |
| | Shared role materials kept on the rig (`tunicMat`, `legsMat`, `bootMat`, `gloveMat`, `bracerMat`) and recoloured by armour | `blenderHero.ts` 304-308; `playerMesh.ts` 126-185 |
| gear | Nodes `Gear_<silhouette>` with suffixes `_torso`, `_armL`, `_armR`, `_legL`, `_legR`, `_L`, `_R`; geometry in mount space | `playerGear.ts` 204, 309-311, 373-375; `build_gear.py` 16-24 |
| | Material names `gear_*` and mesh name classes | `blenderGear.ts` 93-116 |
| | Leg meshes named with the ordinal `_04_` are hidden on the Blender hero (today `Gear_dhide-chaps_legL/R_04_` and `Gear_trousers_legL/R_04_`); merging must keep them and their ordinals | `playerMesh.ts` 280-289 |
| monsters | Node `Monster_<typeKey>` (after Stage 4: `Monster_<model key>`) | `blenderMonsters.ts` 80-81 |
| | Pivots `<key>_HeadGroup`, `_LeftArmPivot`, `_RightArmPivot`, `_LeftLegPivot`, `_RightLegPivot`, `_LWing`, `_RWing`; both leg pivots exist for every type | `blenderMonsters.ts` 60-75, 160-166; test 155, 163-164 |
| | Material name substrings (skin, scale, chitin, feather, cloth, robe, leather, fur, wing, hoof, wood, bark, moss, stone, iron, bronze, steel, glow) and "eye" in mesh names; base colour | `blenderMonsters.ts` 41-58, 110-145; the tint is multiplied only in the non-glow, non-eye branch (142-144), and a skinned or kit path keeps that placement |
| | Size: the clone is reset to scale 1 and the group keeps the builder's scale | `blenderMonsters.ts` 85-87 |
| guard | `/models/guard.glb`, loaded in `createCastleGuard` | `worldBuild.ts` 537-585 |
| all | Parse in node with a bare `GLTFLoader` | test 26-34 |

All of these become the manifest of 7.2. **What skinning does to them:** every pivot name in the table becomes a bone of the same name (6.1.1), so every name lookup holds. Five things change, each declared:

| Contract | Change | Why |
|---|---|---|
| Hero pivots are siblings under `HeroRoot` | They become a chain: `Root`, `Hips`, `Torso`, then `HeadGroup` and the arm bones; the leg bones under `Hips` | A lean of the torso must carry the head and arms. The local height of `Torso` and `HeadGroup` changes (8.3, replacement 2). |
| Hero pivot positions equal `LEAN_RIG` | Hero bones sit at the author's joints (S14): shoulders ±0.178 at 1.478, elbows below them by the author's upper-arm length, hips ±0.111 at 1.007, knees at 0.604, `Torso` at the author's `spine1` (1.146), `Hips` at `waist` (0.963); all recorded in the manifest. Hip x stays 0.11 within 0.005, so lines 60-61 hold; shoulder x does not (8.3, replacement 3). Every mount offset moves by the joint's move (6.1.4). `LEAN_RIG` itself is unchanged: it still builds the procedural placeholder rig | The author's weights bend about the author's joints; bending them about pivots 8 to 11 cm away shears the skin. Decision N-5 |
| `HeadGroup` at height 1.86 | The author's neck joint, 1.504 (S14) | A skinned head turns about the neck. Helm and hat offsets shift by the same amount in the shared mounting function; the mount test pins them. Only `playerMesh.ts` (the mount) and `worldBuild.ts` (the merchant's hat) anchor anything to this pivot. |
| Hide loops search the head and torso pivots for `Hair*`, `TorsoCoat`, `InnerCollar` and the coat prefixes | They search the figure's group | A skinned mesh hangs under the root, not under a bone. The names do not change. |
| Monster and hero templates are cloned with `clone(true)` | Skinned templates are cloned with the skeleton utility | 3.5 S5 |

### 8.2 What is added (never renamed)

| Addition | For | Engine side |
|---|---|---|
| `COLOR_0` on figure meshes, all or none per file | 6.3 | One flag in three upgrade functions |
| A skin on a figure: `JOINTS_0`, `WEIGHTS_0`, one skeleton per figure with the bones of 6.1.2, named `<node key>_<Bone>` in `monsters.glb` (`goblin_Torso`, `ashmantle_Torso`) and bare in `hero.glb`; a bind pose within 20 degrees per limb of the skeleton's reference pose | 6.1 | The skinned path: clone with the skeleton utility, strip the prefix, skinned outline shell, fixed culling sphere, skeleton disposal |
| Optional bones `Jaw`, `WeaponPivot`, `OffhandPivot`, `LWing`, `RWing`, `TailPivot`, `TailPivot2` (biped); the dragon and crawler bones of 6.1.2 | 6.5, Stage 4's wind-up | Found by name; a missing optional bone is skipped, as `findPivot` already allows |
| Bones `Root`, `Hips`, `LeftHand`, `RightHand`, `LeftFoot`, `RightFoot` on bipeds | 6.1.2 | `Hips` position is the one shared position track, scaled per figure |
| Hero clip `Death` (decided 2026-11-14); `Hurt` only if decision N-6 says yes | 6.5 | `HeroClipName` and two call sites |
| Clip libraries on the dragon and the scorpion in `monsters.glb` | 6.5 | A motion table per model key names the clips a model plays |
| Nodes `Kit_saltback_stalker` and `Kit_thornwatch_marksman`, whose children are rigid meshes named after the base figure's bones | 5.6 | A look field `kit?: string` on Stage 4's two rows; after the base clone the kit's children are added under the bones of the same name |
| Node `Monster_ashmantle`: its own skinned body on the dragon skeleton | Owner decision: Ashmantle gets its own model | A look field `body?: string` on Stage 4's boss row. The node lookup reads `Monster_<body ?? model key>`; skeleton, motion table, minimap and every other use of the model key still read `model: 'elvarg_dragon'`. **No model key changes** (critique C4), so Stage 4's tests ("ten distinct model keys", "the boss uses the dragon's model key") stay as Stage 4 left them. |

The gear band nodes (`_b2`, `_b3`) move to the follow-up stage with the bands (section 10).

### 8.3 Tests

**Kept green, untouched:** `tests/run-blender.test.ts`; `tests/credits.test.ts` (the knight's credit line and licence file stay, 10.3); `src/__tests__/lean-rig.test.ts` (it tests the procedural placeholder rig, which stays rigid); `tests/textures.test.ts` and `tests/dispose.test.ts` (they read the outline shell of a **plain** mesh, which keeps today's shell and material; Stage 5's own replacements in `textures.test.ts` are Stage 5's); `tests/facet-light.test.ts` (Stage 5's `facetMaterial` shader-text tests); `tests/gltf-loader.test.ts`; Stage 4's tests over model keys; and `src/__tests__/blender-hero.test.ts` except the three assertions below. In that file these lines must stay green **as written** with the skinned hero: 49 (no gear mesh names), 53-54, 60-61 (hip x: the author's hips are at ±0.111 once the body is centred, S14), 66 (`Walk` turns `leftLegPivot.rotation.x` past 0.01) and 70 (`Slash` turns `rightArmPivot.rotation.x` past 0.05). Lines 66 and 70 hold only because bones are world-aligned (6.1.1); that is the reason for the rule.

`src/__tests__/blender-hero.test.ts` is the only existing test that parses a figure file (checked by search: `tests/world-data.test.ts` reads `world.glb`, which this stage does not touch; `tests/gltf-loader.test.ts` uses made-up addresses; `tests/credits.test.ts` pins the knight's credit line and its `LICENSE.txt`, both kept).

**Declared replacements** (three, all in `src/__tests__/blender-hero.test.ts`, all made in the hero slice; the third was added by the second-pass check and is part of decision N-5):

1. Lines 39-42, `expect(clipNames).toEqual(['Cast', 'Chop', 'Fish', 'Idle', 'Lunge', 'Mine', 'Ranged', 'Slash', 'SpinSlash', 'Walk'].sort())`: exactly ten clip names. Replaced by: those ten are all present, and the full sorted list equals the manifest's hero clips (which adds `Death`, and `Hurt` if N-6 says yes).
2. Lines 56-57, `expect(rig.torso.position.y).toBeCloseTo(LEAN_RIG.torsoY, 2)` and `expect(rig.headGroup.position.y).toBeCloseTo(LEAN_RIG.headY, 2)`: local heights, which assume the flat pivot layout. Replaced by: the heights of `rig.torso` and `rig.headGroup` **in the rig group's space** equal the manifest's `Torso` and neck joint heights to two decimals. Their intent (the body's joints sit where the gear expects them) is kept and widened by the new mount test below.
3. Lines 58-59, `expect(rig.leftArmPivot.position.x).toBeCloseTo(-LEAN_RIG.shoulderX, 2)` and the right one: the shoulder pivots at ±0.28. Replaced by: the x of each arm bone in the rig group's space equals the manifest's shoulder joint x (±0.178) to two decimals. If decision N-5 keeps `LEAN_RIG`'s joints instead, this replacement is not made.

Checked at the premise re-check (plan R0, 2026-11-25): Stage 4 (`d2bf79b`) rewrote only the monsters case (lines 132-164; earlier line numbers unchanged): it pins 13 rows (137), ten distinct model keys (139), each model key a self-mapping type (140-143), and upgrades each `Monster_<model key>` with both leg pivots (146-164). `tests/new-monsters.test.ts` pins the ten models (131-141), the boss on `elvarg_dragon` at `modelScale` 1.2 (98-105), and **the `elvarg_dragon` row deep-equal to `tests/fixtures/existing-dragon.golden.json` with no `model`, `pattern` or `tint` (22-35)**. So no row is added or removed, no model key changes, and the `elvarg_dragon` row (`src/data/catalog.ts` 476) gets no new field. `kit` and `body` go only on the three Stage 4 rows (`src/data/world.ts` 106, 128, 153). The motion table lives outside `MONSTER_TYPES` (`src/data/monsterPoses.ts`). The figure assertions of `tests/textures.test.ts` (81-116, 221-233, 355-368, 396-408) and `tests/dispose.test.ts` (53-69) all read plain meshes or the procedural rig.

**New contract tests** (new files; they replace what the frozen tests cannot see):

| Test | Asserts |
|---|---|
| `tests/model-contract.test.ts` | The shipped files satisfy the manifest of 7.2, including the skin rules (bone list and parents, identity rest rotations, at most 4 influences, weights summing to 1, joint indices in range, rotation-only shared clips) and the budgets of section 9 |
| `tests/skinned-figure.test.ts` | On a tiny skinned fixture: two instances cloned from one template pose independently and leave the template at rest; bone names lose their prefix; every pivot field of the rig is a bone; the outline shell of a skinned mesh is a skinned mesh on the same skeleton with the skinned outline material, and a plain mesh still gets today's shell; the culling sphere is fixed and at least the rest sphere times 1.5; disposal calls `skeleton.dispose`; a rigid figure in the same file still takes the rigid path; a skinned root with a non-identity transform is refused; adding an outline shell to a posed instance leaves a second instance's vertices unmoved (S17); the skinned shell has its own fixed sphere; a clip whose tracks carry the figure's prefix drives the stripped bones once the library is stripped |
| `tests/gear-mount.test.ts` | For a full ten-slot loadout, at the **reference pose** (every pivot or bone's rotation set to identity and its position to its rest value, which neutralises the frame of `Idle` the shipped file carries: shoulders read 1.465 and hips 0.865 there): every mounted piece's position, rotation and scale **in the figure's space** equals a snapshot taken from today's hero within 0.01 and 0.02 rad; the centres of the hand, foot and head meshes in the figure's space are within 0.01 of today's (the joints move, the mesh does not, 6.1.4); `Hair*` hides under a helm and `TorsoCoat` and `InnerCollar` under body armour; the armour recolours the five role materials on the meshes that carry them |
| `tests/hero-model.test.ts`, `tests/hero-clips.test.ts` | Motion ranges per clip, the two frozen samples restated, `Death` wiring (and `Hurt` if N-6) |
| `tests/guards.test.ts` | Guards are dressed hero instances; no request for `guard.glb` |
| `tests/monster-motion.test.ts` | Every bone a model's motion table names exists on its skeleton and has weight on at least one vertex (a bone that moves nothing is how the old dragon was a statue, critique C1); a biped monster plays the hero file's `Walk` and `Slash` and keeps its own bone lengths; the `Hips` track is scaled by hip height; the wind-up scrub stops at the clip's anticipation time |
| `tests/monster-kits.test.ts`, `tests/monster-body.test.ts` | A kit attaches under the base bones; `body` changes the node and nothing else; model keys equal a snapshot |
| `tests/monster-merge.test.ts`, `tests/gear-merge.test.ts` | Triangles per engine material family are unchanged by a merge |
| `tests/model-cache-key.test.ts`, `tests/model-licences.test.ts`, the path-leak case | As before |

---

## 9. Budgets

### 9.1 Per figure

The wire ceilings are redone from measurement (3.5 S9): a smooth 5,000-triangle skinned body is 97 kB on the wire as Blender exports it, and 70 kB with 8-bit normals and weights (S10). The ceilings leave room for the paint layer and for hard parts, and are reset from the pilot's real numbers (plan S2).

| Class | Triangles | Skinned meshes | Materials | Wire ceiling, as exported | With decision N-3 |
|---|---|---|---|---|---|
| Swarm creature (Stage 6) | 1,200 | 1 | 1 | 30 kB | 21 kB |
| Small (chicken) | 2,500 | 3 | 4 | 60 kB | 42 kB |
| Ordinary monster | 5,000 | 4 | 5 | 115 kB | 80 kB |
| Large (giant, guardian, demon; Stage 6 captain) | 7,000 | 4 | 5 | 160 kB | 110 kB |
| Boss (dragon; Stage 6 dungeon boss) | 14,000 | 4 | 5 | 320 kB | 220 kB |
| Ashmantle | 12,000 | 4 | 5 | 275 kB | 190 kB |
| Kit | 1,200 | 2 rigid | 3 | 20 kB | 20 kB |
| Hero body | 6,000 | 11 | as today | 200 kB with twelve clips | 150 kB |
| One gear piece (follow-up stage) | as today | as merged | | | |

Draw calls are in 6.4. Against Stage 5's budget (start pose at most 1,000 colour-pass calls on Medium, and the shadow pass at most 60% of its V2 capture): the start pose is about neutral (two guards at about 26 each against the knight's 27 each; the hero and the townspeople lose a few), and every camp is far under (a goblin camp of seven falls from 413 calls a pass to at most 28). Triangles at the start pose fall by about 87,000 with the knight gone. The exact numbers need a running scene; the plan captures them at M0p, the pilot, N3 and X3.

### 9.2 Bytes on the wire (Brotli quality 3)

The critique was right that organic figures compress far worse than today's box figures (its H5), and skinning adds to it. The honest budget:

| File | Today | After this stage, as Blender exports | With decision N-3 (8-bit normals, weights and colour on the figure files; no decoder) | What is in it |
|---|---|---|---|---|
| `hero.glb` | 137,913 | 200,000 | 150,000 | The same body with its author's weights and no UVs (measured: 105 kB, 3.5 S13), twelve clips, the paint layer |
| `gear.glb` | 668,121 | 690,000 | 690,000 | Merged, otherwise unchanged; bands and paint are the follow-up stage |
| `monsters.glb` | 1,266,221 | 1,800,000 | 1,270,000 | Chicken 60; raider, archer, scorpion, wizard, ranger 115 each; giant, guardian, demon 160 each; dragon 320; Ashmantle 275; two kits 40; eleven clips 45 |
| `guard.glb` | 1,174,350 | **0** (deleted) | 0 | Guards are dressed hero instances |
| `world.glb` | 489,842 | 489,842 | 489,842 | Untouched |
| **Total** | **3,736,447** | **at most 3,180,000** (about 0.55 MB less) | **at most 2,600,000** (about 1.1 MB less) | |

What this means in plain words: the stage still shrinks the download, because deleting the knight pays for everything; but `monsters.glb` grows by about 0.5 MB, because a new dragon, a second boss body and nine continuous skinned bodies weigh more than boxes do. The earlier draft's 2.85 MB assumed a reduced old dragon and a kit for Ashmantle; the owner's answers replace both with new bodies.

Reserve handed on: Stage 6's captain, swarm creature and dungeon boss are about 0.51 MB as exported (0.35 MB with N-3), and the follow-up gear stage about 0.23 MB. **Without N-3 the total is back at about 3.7 MB after Stage 6, just under today's 3.76 MB, and passes it with the gear stage (about 3.9 MB). With N-3 it stays near 3.2 MB after both.**

**Compression (was CALL-M9b; now decision N-3).** Three options, for the owner:

| Option | Saves | Costs |
|---|---|---|
| Nothing | 0 | The totals of the middle column |
| **8-bit normals, weights and colour on `hero.glb` and `monsters.glb`** (recommended) | about 30% of those two files, measured on a skinned figure (3.5 S10): about 0.58 MB | One plain node script of about 60 lines run inside the promote step; one glTF extension (`KHR_mesh_quantization`) that three's loader reads with no decoder and no dependency; the frozen tests parse it with the bare loader (measured). Positions stay floats, because the engine projects albedo UVs from them in metres. Worst posed-vertex error measured: 0.5 mm |
| Revive the shelved design (meshopt and 8-bit normals on all five files) | 32% of everything, by its own measurement on rigid files | A decoder wired into the loader (25 kB of script), four pinned dev dependencies, a second set of committed files, and the frozen tests can no longer read the shipped files with a bare loader. It was measured on files without skins and would need re-measuring |

Recommendation: the middle option now; leave the shelved design shelved. Revisit it only if the total passes 3.76 MB again.

Per-figure numbers are ceilings from one measured probe body, not from the real figures: the pilot measures the first real one and resets the table before any other figure is built. **They are tight as exported** (second pass): the probe body was 97 kB with no paint and no hard parts, and the paint layer alone added 22 to 26% on the wire on the goblin (3.3), so a painted 5,000-triangle body is about 118 to 122 kB before its weapon, against a 115 kB ceiling. Expect the "as exported" column to land nearer 3.4 to 3.5 MB than 3.18 MB, still under today's 3.74 MB; the N-3 column is the one that holds with margin. The 8-bit step was measured on normals and weights only (S10, S17); `COLOR_0` at 8 bits is plain glTF and is expected to save its half, but was not run.

### 9.3 Load time and memory

Parse time follows raw bytes: 11.9 MB today; an estimate of about 8.3 MB after, as exported (about 7.2 MB with N-3), since the knight's 1.7 MB goes and smooth skinned bodies carry far fewer vertices per triangle than today's boxes. GPU and heap memory per instance fall with the mesh count (4.5). Each skinned instance adds one bone texture of a few hundred bytes. No new request is added: `guard.glb` is one fewer.

---

## 10. Scope: slices in order

The stage is much bigger than it was: every figure is rebuilt or re-rigged, the engine gains a second way to load and draw a figure, and three clip libraries are authored. So the first slice a player can see is a **pilot**: one figure, skinned, in the game, end to end, before anything else commits to the approach. Each slice is showable alone and ends with before and after sheets, an in-engine capture, and the owner's look.

| # | Slice | Why here | What the owner sees | Effort |
|---|---|---|---|---|
| 0 | **Safe pipeline and review loop**; contract manifests; baseline sheets of everything; the vertex-colour flag in the engine (inert until a file carries `COLOR_0`) | Nothing can change safely or be judged without it | Sheets of today's figures | 12 tasks, small |
| 0b | **Merge-only pass over every monster** (no shape change) | The cheapest test of whether draw calls are what holds the frame rate (6.4) | Nothing changes on screen; the draw-call counter and the frame rate at a goblin camp, before and after | 2 tasks, small |
| 1 | **Pilot: the goblin raider, rebuilt and skinned, in the game.** The figure kit (rig, body, weights, merge by family); the engine's skinned path; the contract tests for skins | Proves the whole chain on one cheap figure: script to file to loader to outline, shadow, culling, Stage 4's reactions on bones. A goblin is the first thing a new player fights | **The first visible result: a goblin whose arms, legs and back bend**, beside today's goblins, at the camp | 6 tasks (7 with decision N-3), medium |
| 2 | **Hero**: skinned with its author's weights at the author's joints (N-5); eleven smooth clips on bones (ten re-authored, `Death`; `Hurt` only if N-6); gear mounted on bones; the paint layer; townspeople follow | On screen every second of play; creates the biped clip library | The hero bending at elbow and knee in every action, in and out of armour; falling on death | 8 tasks, large |
| 3 | **Gear merge and guards**: gear meshes merged with no shape change; guards built from the hero and armour; `guard.glb` and the knight's `.blend` deleted | Pays for the download; the guards need the merge or they cost 62 calls each | Two guards who breathe, in guard steel; 1.17 MB less | 6 tasks, small |
| 4 | **Monsters driven by clips** (the pilot goblin switches first, to the hero's own `Walk`, `Slash` and `Death`); then **dragon (new), Ashmantle (its own body), lesser demon (rebuilt)**, with the dragon clip library (owner: dragon and demon first among the monsters) | This is where reuse becomes visible; two bosses and the demon stand still today | A goblin swinging and falling with the hero's motions; bosses that walk, bite, raise their wings and fall | 9 tasks, large (the hardest art) |
| 5 | **Goblin archer** rebuilt; **chicken** re-rigged | The start region | The first camp complete | 2 tasks, medium |
| 6 | **Scorpion** re-rigged on the crawler rig with its library; **dark wizard and dark ranger** rebuilt; **kits** for Saltback Stalker and Thornwatch Marksman | Mid game | A tail that strikes, a robe that swings, two variants with outlines of their own | 6 tasks, medium |
| 7 | **Hill giant and moss guardian** re-rigged | Late game | The last two figures | 2 tasks, medium |
| 8 | Rigid monster path removed; final budgets; hand-off | | | 3 tasks, small |

About 58 tasks with the premise re-check, against 56 before; the count is similar because the gear bands left, but the art tasks are larger and there are more of them.

### The pilot's go/no-go (added by the second pass)

OM-P is a real gate only if it is decided on stated evidence. The pilot (plan S3) must bring all of these, and the owner decides on them:

| # | Criterion | Pass |
|---|---|---|
| P-a | The file | Contract and Budget pass, including the skin rules; Brotli bytes of the figure measured for each route and variant |
| P-b | Correctness in the game | No vertex off its body in any captured pose; the outline follows a bent arm; the shadow follows the pose; no pop at the screen edge or half off it; `renderer.info.memory` geometries and textures back to their start value after 30 kills and respawns |
| P-c | Cost | Draw calls at the camp at most M0p's minus 20 per skinned goblin in view; frame time at the camp not worse than M0p's on the owner's machine |
| P-d | Shared motion on another stance | The pilot goblin, still code-posed in the game, is also captured in a throw-away worktree playing the hero's `Walk` and `Slash`, converted by 6.1.5's rules in scratch (the shipped clips are sibling-space with position tracks and would overwrite its joint offsets, S4), through a minimal animator (the first shared clip on a different body; without this, that is first seen only at M1b, after the whole hero slice) |
| P-e | Form at close range | The head and hands at distance 5.4 (about 340 px tall), beside today's goblin, for both body routes |
| P-f | The owner's look | Better than today's goblin at all three distances, and a direction the owner wants for eight more figures |

Outcomes: **accept** (go on with the chosen route); **accept the engine path, reject scripted bodies** (figures come from CC0 or CC-BY rigged bases with their weights folded onto the shared rigs, 6.2 item 3, each with its own sign-off; or the remaining monsters stay rigid and merged, as M0p left them, and the rigid path is not deleted); **stop** (the engine branch and the one figure are reverted; slice 0 and M0p stay).

### Not in this stage, and why

| Item | Where it goes | Reason |
|---|---|---|
| **Gear bands** (5.5), gear brought to budget, gear paint | **Follow-up stage: "Models pass, part 2: gear"** (decision N-2) | Independent of the skeletons; the stage had to give something up to stay finite. The gear **merge** stays here, because the guards need it. |
| **Skinned gear**: robe skirts, capes, trousers across the knee | The same follow-up stage | A second mounting path and new weights per piece (6.1.4). Rigid gear on bones works today's way. |
| Per-species idle traits, second attack clips | The same follow-up stage, or Stage 6 per boss | One library per skeleton is the reuse the owner asked for; extras come after it works. |
| Camp captain, swarm creature, dungeon boss | Stage 6 | They have no rules yet. They will arrive on the biped and crawler rigs with the clips those rigs already have, so a shape study now would be redrawn (the critique's D-6: cut). |
| Level of detail | Not planned | 6.6 |
| A new original hero in place of Kai | Not planned; the owner keeps the hero ("ok", 2026-11-14) | |
| World props | Out | 4.4 |
| Model compression with a decoder | Stays shelved; see decision N-3 for the option without one | 9.2 |
| Renaming borrowed names in node names (`Gear_bandos-chest`, `Monster_elvarg_dragon`) | Out | "Names stay as they are"; they are also contracts |
| A fourth skeleton (snake, bat, fish) | When a creature needs one | 6.1.2 |

### Hand-off to Stage 6

Stage 6 receives: the safe pipeline and review loop; `figkit.py`; the three skeletons and their clip libraries; the skinned path in the engine; the budget classes of 9.1; the contract for a new monster (one `Monster_<model key>` node with a skin on one of the three skeletons, bones named `<model key>_<Bone>`, a motion-table row naming library clips, a manifest entry, a credit row if third-party); and the art direction of section 5. A new biped or crawler monster is then: one builder function, one data row, one review, and no new animation.

### 10.3 Guards (slice 3) in detail

`createCastleGuard` builds each guard from `buildHumanoidRig` upgraded with the hero GLB (now a skinned instance) and dressed with existing gear visuals (helm, plate body, plate legs, kite shield, sword) in guard steel. The merchant mounts only a hat; a full set needs the mount offsets and hide rules of `rebuildPlayerEquipmentMeshes` (`playerMesh.ts` 95-404), so those are moved into one exported `mountLoadout(rig, items)` that the player, the merchants and the guards all call (no copy; the hero slice does the move, because the helm offset changes there, 6.1.4). Positions, dialogue, hitbox, `userData` and `npcList` labels are unchanged. Guards play `Idle` from the biped library. `public/models/guard.glb` and `scripts/blender/export_guard.py` are deleted, and so is `blender/examples/knight_28541/knight.blend` (owner: "ok", 2026-11-14). `blender/examples/knight_28541/LICENSE.txt` and the knight's `CREDITS.md` line stay, moved to a "source removed; credit kept" part, so `tests/credits.test.ts` stays green (it pins only the licence file and the credit line); this takes the one asset with an unstated upstream licence out of the game and out of the public repository.

---

## 11. Threat model

### 11.1 What are we working on?

A build pipeline: Python scripts run inside Blender, read third-party `.blend` files and a zip, and write binary models that are committed and served to every player. Inputs: the scripts, `blender/examples/` (untrusted, authored by strangers), command-line arguments. Outputs: GLB files parsed by three's `GLTFLoader` in players' browsers, `.blend` files, review images. Trust boundaries: third-party file into Blender; build output into the repository; repository into the player's browser; licence terms into a public deployment. Callers: a developer or an agent through `npm run blender:*`.

### 11.2 What can go wrong?

| # | Failure |
|---|---|
| T1 | A build overwrites shipped assets in place (the trap), and a broken model is committed unnoticed. |
| T2 | A third-party `.blend` carries a script that runs on open, or a driver expression. |
| T3 | The zip contains a path that escapes the extraction directory. |
| T4 | A contract breaks silently: a missing pivot makes the hero loader return null and fall back to the cylinder rig (`blenderHero.ts` 170-173), or a monster stops moving. No test fails if the test only checks names loosely. |
| T5 | A model far over budget ships: long load, memory pressure, a tab that dies on a weak device. |
| T6 | An asset whose licence does not allow redistribution, or needs credit that is missing, is deployed. |
| T7 | A changed GLB is served from cache under an unchanged URL to new code that expects new nodes. |
| T8 | A `.blend` or GLB carries an absolute path with a user name (seen: the original author's home path inside the Kai file). |
| T9 | Blender exhausts memory on the shared machine and takes other work down. |
| T10 | Two Blender versions produce different files and a review compares the wrong thing. |
| T11 | An agent's "it looks better" is taken as proof. |
| T12 | Review images bloat the repository. |
| T13 | A malformed GLB from a half-finished build is promoted. |
| T14 | A skinned figure is cloned the old way: every instance is bound to the template's bones, so all goblins move as one or the template is corrupted (measured, 3.5 S5). |
| T15 | A file ships with bad skin data (weights that do not sum to 1, a joint index outside the skin, more than 4 influences, a bone that deforms nothing): vertices fly to the origin, or a figure stands still as the old dragon does. |
| T16 | Bone textures leak when monsters respawn, because disposal does not know about skeletons. |
| T17 | A skinned figure vanishes at the edge of the screen: its culling sphere is the rest pose's and the pose has left it (measured, 3.5 S6). |
| T18 | A third-party rigged source brings a licence problem or a hostile file, now that such sources are allowed for rigs too. |

### 11.3 What are we going to do about it?

| # | Answer |
|---|---|
| T1 | Eliminate: builds cannot write into `public/` or `blender/` (7.1); promotion is a separate, named, explicit step behind the compare (7.2). |
| T2 | Mitigate: `--disable-autoexec` on every call, pinned by `tests/run-blender.test.ts`; `--factory-startup`, added to the runner by P2 (it is missing today); sources are data-linked by object name only (`libraries.load`), never opened as the session file, except the three files that are opened whole (Kai, the knight until slice 3). Accept: Blender itself parsing a hostile file; sources are added only by owner sign-off (K6). |
| T3 | Mitigate: every zip member's resolved path must start with the extraction directory, else the build stops. |
| T4 | Mitigate: the manifest and its test (7.2, 8.3) check exact names, parents and positions; the compare refuses promotion. |
| T5 | Mitigate: budgets in the manifest test and in the compare; a file over 8 MiB raw is refused outright. |
| T6 | Mitigate: `tests/credits.test.ts` plus a new assertion that every entry under `blender/examples/` is named in `CREDITS.md`, that a directory holds a licence file, and that a zip lists a licence member (Kai's licence lives inside its zip); the licence list of 6.2. |
| T7 | Eliminate: the `?v=` key is the file hash, kept equal by a test. |
| T8 | Mitigate: a test scans each GLB's JSON chunk for `/home/`, `/Users/`, `C:\` and the like; `.blend` files are saved with relative paths and no packed third-party textures. |
| T9 | Mitigate: one process, 3 GB cap, 10-minute timeout, in the plan's command table. An out-of-memory kill is a defect, never a reason to raise the cap. |
| T10 | Accept, with a control: structural compare, generator string printed in every report. |
| T11 | Mitigate: agents report measurements and file paths only; every slice ends at an owner step. |
| T12 | Mitigate: JPEG sheets, 2 MB per slice, checked by the slice's last task. |
| T13 | Mitigate: the compare parses the whole file and every accessor range before any check; promotion copies to a temporary name and renames. |
| T14 | Eliminate: one helper clones skinned templates, and `tests/skinned-figure.test.ts` poses two instances and checks the template stayed at rest. |
| T15 | Mitigate: the manifest test validates every skin of every shipped file (7.2); `tests/monster-motion.test.ts` requires every bone a motion row names to carry weight. The compare refuses promotion. |
| T16 | Mitigate: `disposeObject3D` disposes skeletons; the same test asserts it. Stage 5's leak check (a human gate, visual-pass plan G-6; no automated test exists: GPU resources return to the start value after 200 attacks) is re-run at X3. |
| T17 | Mitigate: a fixed sphere of 1.5 times the rest radius per skinned mesh, asserted by the same test; the owner's walk through every camp at each slice is the check that nothing pops. |
| T18 | Mitigate: as T2 and T6: CC0 or CC-BY only, licence file beside the source, credit row, one owner sign-off per asset, opened with `--disable-autoexec` and `--factory-startup`, data-linked by name. |

### 11.4 Did we do a good enough job?

Each answer above has a test or a refusing command, listed in the plan's task that builds it. The pipeline is proven by doing the dangerous thing safely first: slice 0 ends with a full rebuild of all five files into scratch, a compare report with zero contract differences, and nine unchanged hashes.

---

## 12. Save format and game rules

No change. No save field is read, written or migrated. No item, monster, stat, drop, formula, name or position changes. The motion table (6.5) is look data. The optional `kit` and `body` fields (8.2) are look fields on rows Stage 4 already created, and no model key changes. Skinning changes how a figure is drawn and nothing about where it is, how large its hitbox is, or when it acts.

---

## 13. Decisions

### 13.1 Decided by the owner on 2026-11-14

Answers are quoted as given (translated where the owner wrote in Portuguese).

| # | Decision | The owner's words | What it does here |
|---|---|---|---|
| CALL-M3, D-1 | Rigid jointed figures, or meshes that bend | "Mesh that bends for everything, including the hero. It makes it easier for us to reuse some things, if possible." | **Every figure is a skinned mesh on a skeleton**: hero, guards, every monster, the bosses. This overrides the recommendation (rigid). Sections 6.1, 6.4, 6.5, 8, 9, 10. |
| CALL-M7 | The dragon | "Build a new one." And: "Any other mobs, we can rebuild. We have inspirations in games like RuneScape, Tibia, Ragnarok, etc. Whatever is needed, we rebuild." | The dragon is a new model. Ashmantle gets its own body on the dragon skeleton, not a kit. Section 4.6 decides the rest figure by figure: the dragon and Ashmantle are new, five monsters are rebuilt (both goblins, the wizard, the ranger, the demon), four are kept and re-rigged (chicken, scorpion, giant, guardian), and the hero is kept. "Inspirations" is read as spirit and technique, with original designs and no replica of any game's creature or character (K7). |
| CALL-M4 | The hero | "Ok" (keep the current one and improve it) | The hero keeps its body and identity and gets a skeleton and a skin from its author's own weights. |
| D-4 | Motion: held poses or smooth | "Smooth" | Clips are interpolated; no stepped clip is built; the one-clip style comparison is dropped (5.7). |
| CALL-M2 | The guards | "Pode refazer" (you may rebuild them) | Built from the hero body and armour; `guard.glb` is deleted (10.3). |
| CALL-M11 | Vertex colour as the paint layer | "Ok" | 6.3. |
| D-2 | Dragon and demon first among the monsters | "Ok" | Slice 4, straight after the hero and the guards (the pilot goblin before them is a test of the method, decision N-1). |
| CALL-M6 | A hero death animation | "Ok" | `Death` is added. `Hurt` was not asked; it is now an owner decision (N-6), not part of the stage by default. |
| D-3 | Delete the knight's `.blend` once the guards are rebuilt | "Ok" | Deleted in slice 3; its licence note and credit line stay (10.3). |
| CALL-M8 | Third-party models as sources | Allowed, CC0 or CC-BY, recorded in `CREDITS.md` | 6.2 item 3, now also for rigged models. |

### 13.2 New decisions the answers create

| # | Decision | Recommendation, in plain words |
|---|---|---|
| **N-1** | **Which figure is the pilot.** One figure goes through the whole new chain before anything else commits to it: the goblin raider, the hero, or the new dragon. | **The goblin raider.** It is cheap to redo, it is the first monster a player meets, and it tests everything the method needs except worn gear. The hero is on screen all the time and carries ten animations and all the armour, so a failed first attempt there costs most. The dragon is the hardest shape to build by script, so a failure there would not tell us whether the method or the dragon was at fault. The dragon and the demon still come first among the monsters proper, as you decided. |
| **N-2** | **Split the stage.** Every figure is now rebuilt or re-rigged and the engine gains a second way to draw a figure; with the gear work on top it would be about 66 tasks. Either keep gear bands (armour whose outline changes with its tier), gear clean-up and bending cloth gear in this stage, or move them to a follow-up stage. | **Move them to a follow-up stage.** This stage is then "skeletons and figures", and ends with every figure skinned. The follow-up is "gear": bands, and robes and capes that bend. Nothing in the follow-up is needed for the figures to work. |
| **N-3** | **Download size.** New skinned bodies weigh more than today's box figures. The stage still ends about 0.55 MB under today, but Stage 6 and the gear stage would bring the total back to today's 3.76 MB and past it. A small build step that stores normals, weights and colours in 8 bits removes about 30% of the two figure files with no decoder in the game. | **Yes to the 8-bit step; keep the shelved compression design shelved.** Measured on a skinned figure: 30% smaller, read by the game's loader as it is, worst error half a millimetre. The shelved design saves about as much again but adds a decoder, four build dependencies and a second set of files. |
| **N-5** | **Where the hero's joints go** (second-pass finding, S14). The author's weights bend the hero at the author's joints, but today's pivots are 8 to 11 cm away from them (shoulders 10 cm too far out, hips 11 cm and knees 8 cm too low; this is also why today's knees and elbows show seams). Either move the bones to the author's joints and build the hero in its own pose, or keep today's pivot positions. | **Move them to the author's joints, and keep the hero's own slightly arms-out pose as the pose every biped is built in.** The skin then bends where it was made to bend, today's ten animations stay valid as they are (they were written for that pose), and no hand-made weights have to be re-posed. The cost: one more frozen hero test line (shoulder width) is replaced by a declared one, and every gear offset is recomputed by a small formula that keeps each piece exactly where it sits today. Keeping today's pivot positions keeps that test line but makes the skin shear at the shoulders, hips and knees in every step and swing. |
| **N-6** | **The `Hurt` animation.** Not asked for; proposed as a shared "I was hit" motion for the hero and every biped and dragon. Stage 4 already gives the hero a lean and monsters a flinch when hit. | **Leave it out of this stage.** Stage 4's lean and flinch already show the hit and keep working on bones; `Hurt` adds a clip per library and a rule for when it may interrupt what. Add it later if hits feel weak in play. |
| **N-4** | **One draw call per monster, or up to three.** One material per monster means one draw call, with every colour painted per vertex; but then cloth, hide and metal all answer light the same way. Up to three materials keeps that difference for three draw calls. | **Up to three, decided on the pilot**, where both are shown in the game. Either way a goblin falls from 59 draw calls to 3 or fewer. Keep one-call figures for crowds (Stage 6's swarm). |

### 13.3 Lead's calls the owner has not been asked to rule on

Stated so they can be overturned: the early merge-only pass over the monsters stays (critique D-5; 6.4 says why); the shape studies of the three future monsters are cut (critique D-6; they arrive on existing rigs in Stage 6); any Blender 5.x may build a shipped file, the manifest decides (CALL-M9); a `.blend` is promoted only together with its GLB, without packed third-party textures (CALL-M10); review sheets are committed, 2 MB per slice at most (CALL-M13); the essence list of section 1 (CALL-M1) and the art direction of section 5 (CALL-M12) are confirmed at the baseline sheets (plan step OM-1).

---

## 14. Risks

| Risk | Likelihood | Answer |
|---|---|---|
| Stages 4 and 5 land differently from their designs (the `model` field, `facetMaterial`, `photo.ts`, run-time merging, how the hero's lean is applied over the mixer). | Medium | Plan task R0 re-checks every premise first and amends this document before any other task. |
| The banded light is wrong on a bent limb because a shader patch reads the normal before the skin is applied. | Medium today, low after Stage 5 | Measured on today's patch (3.5 S7). Stage 5's light model uses three's own normal. R0 reads the shader that landed; the pilot's capture shows a bent arm in light and shadow. |
| A scripted body cannot reach the form the owner wants; faces and hands stay crude. | **High for the dragon, medium for the rest** | The pilot tries two body routes before eight more figures follow. Fallback per figure: a CC0 or CC-BY rigged model with its weights folded onto the shared rig (6.2). The old dragon and the Red Devil stay in the repository as last fallbacks; both carry armatures. |
| Automatic weights pinch or drag (a jaw pulling the neck, a cloak stuck to the legs). | Medium | Per-figure weight rules (6.1.6); a worst-pose sheet per figure; judged in the game at every art task. |
| The hero's skin shears because its bones do not sit at the author's joints. | High if `LEAN_RIG`'s pivots are kept, low at the author's joints | S14 measured the gap (8 to 11 cm). The design binds at the author's joints in the source's own pose (N-5), which S13 rendered without tears; no re-pose of the author's weights is done. The first hero task shows a worst-pose sheet before any clip is converted. |
| A skinned figure is drawn off its place, or every instance of it moves when one gets an outline. | Certain without the rules, measured (S15, S17) | Skinned roots at the origin of the file (6.1.1 rule 2b, refused by the manifest test); shells bound with the mesh's bind matrix; both cases in `tests/skinned-figure.test.ts`. |
| Rigid gear on a bending body shows the body through the gaps at elbow and knee. | Medium | The armour recolours the body's materials to its own colour (today's behaviour), so a gap shows armour colour; the mount test pins positions; the hero slice captures the plate set in the worst poses. Skinned gear is the follow-up. |
| Shared clips look wrong on a figure with very different proportions or stance (the giant's arms pass through its belly; a hunched goblin over-reaches). | Medium | Rotations are shared, bone lengths are not, and the bind pose is held within 20 degrees per limb of the reference (6.1.1); each figure's motion row may scale a clip's arm swing or add a stance offset; judged per figure at its capture. A figure may get one clip of its own. |
| Two load paths live side by side for the whole migration and one rots. | Medium | The loader branches on the file's content, not on a list; `tests/skinned-figure.test.ts` covers both in one file; slice 8 deletes the rigid monster path. |
| The stage is too large to finish as one. | Medium | Every slice is promoted and playable alone; the pilot gates the rest; decision N-2 moves gear out. |
| Vertex colour multiplies badly with the banded light or the albedo tiles. | Medium | The bake strength is one number per figure; judged on the pilot, then on the hero. |
| Software-rendered captures mislead about colour. | High | Stated in every capture's README; the owner's look on a real GPU accepts the slice. |
| Skinning costs frame time instead of saving it. | Low | 16 to 22 bones per figure against 22 to 68 object matrices today; 2 to 4 draw calls against 22 to 68. The pilot's capture records calls and frame time at the camp. |
| Draw calls turn out not to be what limits the frame rate. | Unknown | The merge-only pass measures it first (6.4). The stage's case then rests on look and reuse. |
| The byte budget of 9.2 does not hold. | Medium | Ceilings come from one probe body. The pilot measures a real figure and resets them; N-3 is the lever. |
| Art tasks cannot be fully specified, so they are not agy work and cost more. | Certain | Mechanical tasks (pipeline, merging, wiring) go to agy; the art builders stay with Claude; one figure sets the pattern before the rest. |

---

## 15. What could not be verified

- How any figure looks **in the game**: no dev server, no build and no in-engine capture was run. Every judgement of "weak" in section 4 comes from Blender renders of the GLB with its own base colours, plus the code.
- Anything on a real GPU, and any frame time. The claim that the owner's 51 FPS is bound by draw calls is a guess until the merge-only pass measures it.
- Stage 4 and Stage 5 code. Neither is on this branch; their designs were read. In particular: what `facetMaterial` looks like after Stage 5, and how Stage 4 applies the hero's lean over a running clip.
- **Skinning in the game's own engine code.** The experiments of 3.5 used three's loader, clone utility and mixer directly, and copies of the two shaders in a headless browser. `upgradeMonsterRigWithGltf`, `upgradeHumanoidRigWithGltf`, `addCartoonOutline`, `sealAlbedoUvs` and `poseMonsterLimbs` were read, not run, against a skinned file.
- **The quality of scripted figures.** The probe body is a limbed blob with no head, hands, clothes or weapon. That automatic weights bend it cleanly says little about a wizard's robe or a dragon's wing. No rebuilt figure exists yet, and none was drawn.
- **Shared clips across different bind poses.** S4 varied proportions, not pose: both probe figures were bound almost alike. That a goblin bound with a hunch and arms held out looks right under the hero's clips is the design's expectation (6.1.1 rule 3), first seen at plan M1b.
- **The hero's clips converted to the chain.** The conversion of 6.1.5 is arithmetic and was not run; the frozen samples (a leg at 0.2 s of `Walk`, the right arm at 0.15 s of `Slash`) were checked by reading the functions, not by building.
- **The hero's skin at its final joints.** Its author's weights were folded and bent in the source's own pose at the author's joints, at thumbnail size, as ten separate meshes; seams between those meshes under a bend were not inspected. Bending them about `LEAN_RIG`'s pivots instead was not rendered: the second pass measured the 8 to 11 cm gap (S14) and judged it from that.
- The gear on a bending body: no gear piece was mounted on a bone of the real hero.
- The paint layer on a skinned figure, in Blender or in the game. The bake, its time, its export and its byte cost were measured on one rigid figure.
- Every byte number of section 9 except: today's files, the probe body with and without skin and 8-bit attributes, two clips, and the hero's geometry with its author's weights. The per-figure ceilings are extrapolated from the probe.
- The 8-bit step on a file with vertex colour, with several skinned meshes, or through the game's own loading functions; and whether Blender can re-import such a file (it does not need to: the step runs after the build).
- Whether a skinned body can be shared between a figure and its variant some other way than the linked-data export that failed (3.5 S12).
- `tests/textures.test.ts` and `tests/dispose.test.ts` were read for their outline assertions only.
- `run-blender.mjs export` on a `.blend` saved by Blender 5.2.
- The live server's exact Brotli level; quality 3 matches it within 0.7%.
- Draw-call and triangle counts in a running scene; the figures here are per file, and the call counts of 3.5 S8 are from a test page, not the game.

---

## Review log

Review of 2026-11-14 by an independent critic: `docs/superpowers/specs/2026-11-14-models-pass-critique.md` (verdict READY-WITH-FIXES). Each issue was checked against the files at `31bd74d`, or by an experiment, before it was applied.

| # | Issue | Result | Where |
|---|---|---|---|
| C1 | Dragon and demon bodies sit outside their pivots and do not move | Applied: cut by their armatures (6.1), dragon first (10), D-1, D-2 | 1 fact 2b, 4.2, 6.1, 10, 13 |
| C2 | Motion review shows `Idle` for every clip; `Slash` is not a shrug | Applied: method corrected, hero motion rescoped to measured weak clips, one-clip spike first | 3.3, 4.2, 5.7, 6.5, 7.3 |
| C3 | `playerMesh.ts` name and mount-offset contracts missing | Applied | 6.4, 8.1 |
| C4 | Changing model keys breaks Stage 4's tests; kit-only `Monster_` nodes break the loader | Applied: `kit` field and `Kit_<name>` nodes, model keys unchanged | 8.2, 8.3, 14 |
| H1 | Contract compare contradicts every art task | Applied: Contract is built against manifest; built against shipped is Drift | 7.2 |
| H2 | Parallel slices collide on the manifest and engine files | Applied: manifest per file; the vertex-colour flag moves to slice 0 | 6.3, 7.2, 10 |
| H3 | Hero first seen in the game only after promotion | Applied: capture at the end of every art task; engine palette in sheets | 7.3 |
| H4 | Guards from the hero raise draw calls | Applied: slice 3 after the gear merge; numbers corrected | 9.1, 10 |
| H5 | Per-slice byte signs not credible | Applied: `TEXCOORD_0` dropped from figure exports; per-figure wire ceiling set at M2 | K2, 6.3, 9.2, 10 |
| H6 | Scripted primitives have a form ceiling | Applied: M2 tries a remeshed organic body as well | 6.2, 14 |
| H7 | "Held poses at 12 fps" undefined and untried | Applied: D-4 decided on a spike | 5.7, 13 |
| M1 | Write targets `--render`, `export`; `--factory-startup` missing | Applied | 7.1, 11.3 |
| M5 | Licence test misses the Kai zip | Applied | 11.3 T6 |
| M6 | The knight mesh stays public after the guard is deleted | Owner decision D-3 | 10.3, 13 |
| M7 | The detail layer adds calls up close and saves only triangles | Applied: cut | 6.6, 8.2, 9.1, 10 |
| M10 | The draw-call gain from merging arrives late | Applied: merge-only monster pass M0 (D-5) | 6.4, 10 |
| M11, L2, L3 | Value claims, gear node count, CI scope | Applied | 1, 4.3, 5.4, 7.1 |
| H8 | No comparison with how other games build characters | Applied: generic table; rigid segments named a deliberate retro choice against the skinned norm | 6.0 |
| H9 | Paint before OM-S1 under D-2; dragon pose numbers never seen on a mesh | Applied: dragon unpainted until OM-S1; dragon and demon pose rows may be retuned | 14; plan D2a, D2b |
| E11 | `TEXCOORD_0` drop saves raw bytes, only 3% on the wire for box figures | Applied: claim corrected | 6.3 |

### Revision of 2026-11-14: owner decisions

The owner answered the open decisions (section 13.1). The answers change the stage's foundation, so this is a rewrite of the technique, contract, budget and scope sections, not a patch. Experiments S1 to S13 (section 3.5) were run for it; nothing shipped was touched.

| Area | What this revision changed | Where |
|---|---|---|
| Foundation | Rigid segmented figures replaced by **skinned meshes on three shared skeletons** (biped, dragon, crawler) for every figure. Bones keep the pivots' names, positions and axes, which is what lets mounting, monster posing and Stage 4's reactions carry over | 1, K4, 6.0, 6.1, 8.1 |
| Reuse | One clip library per skeleton; rotation-only clips shared across proportions (measured); the wind-up pose becomes the attack clip's anticipation; kits; guards and future monsters on existing rigs | 5.7, 6.1.2, 6.5 |
| Engine | The skinned path specified against three 0.169: skeleton clone, prefix strip, skinned outline shell and material, fixed culling sphere, skeleton disposal, banded light after the skin, clicks unchanged, both paths side by side during migration | 6.1.3, 6.1.5 |
| Gear | Stays rigid, mounted on bones at today's offsets; the helm offset follows the head joint to the neck; hide rules search the figure's group; skinned gear named and deferred | 6.1.4 |
| Figures | Dragon is a new model; Ashmantle its own body through a `body` look field (model keys unchanged); demon, goblins, wizard and ranger rebuilt; chicken, scorpion, giant and guardian kept and re-rigged; hero kept with its author's weights; guards from the hero | 4.6, 5.6, 8.2 |
| Motion | Smooth only; the stepped comparison and D-4 are gone; `Death` decided, `Hurt` added as the shared hit reaction | 5.7, 6.5 |
| Dropped as moot | Joint caps; cutting third-party bodies by bone weights (`cut_by_weights`); reducing the old dragon; the Ashmantle kit; the pose-table-only monster motion; held poses; the "keep the knight" alternative; shape studies of the future monsters | 6.1, 6.2, 10 |
| Kept from the critique | The safe build pipeline; one manifest per file with Contract, Budget and Drift; in-engine capture for every art task; the pattern figure built two ways (now the pilot); the early merge-only pass (kept as the cheapest test of whether draw calls bind); model keys never change | 6.4, 7, 8 |
| Tests | Two declared replacements in `blender-hero.test.ts` (the exact clip list; the local heights of torso and head), every other frozen assertion kept, new contract tests for skins, mounts and shared clips | 8.3 |
| Budgets | Redone from measurement: a skinned organic body is about 97 kB per 5,000 triangles; the total is at most 3.18 MB as exported (was 2.85 MB) or 2.60 MB with 8-bit attributes; `monsters.glb` grows by about 0.5 MB | 9 |
| Scope | Re-cut around a pilot (the goblin raider, skinned, in the game) before anything else commits; gear bands and skinned gear moved to a follow-up stage | 10 |
| Decisions | Ten marked decided with the owner's words; four new ones (N-1 pilot figure, N-2 stage split, N-3 8-bit attributes, N-4 one or three draw calls per monster); the second pass added N-5 (hero joints) and N-6 (`Hurt`) | 13 |
| Threats and risks | Skinned-clone, bad-skin-data, bone-texture leak, stale culling sphere and rigged third-party sources added; risks rewritten | 11, 14 |
| Self-review before the commit | The hero's clips are converted for the bone chain, not copied (today's pivots are siblings); shared clips need a bounded bind pose, which the probe did not vary; mount checks are in the mount bone's local space because the shipped rest pose is not neutral; the bone prefix is the node's key, so Ashmantle's is its own | 6.1.1, 6.1.4, 6.1.5, 8.3, 15 |

### Second-pass check of the revision (2026-11-14)

An independent check of `git diff 8170cc4 d7b41aa` against the engine code and four new experiments (3.5, S14 to S17). Details and evidence: the critique file, section "Second pass".

| Finding | Change | Where |
|---|---|---|
| The hero's bones were to sit at `LEAN_RIG`'s pivots, 8 to 11 cm from the joints its author's weights bend about | Bones at the author's joints; the biped reference pose is the hero's own A-pose; no re-pose; mount offsets re-derived; a third declared replacement (shoulder x); decision N-5 | 4.6, 6.1.1, 6.1.4, 8.1, 8.3, 13.2, 14 |
| A skinned figure laid out off the origin is drawn 6.32 units off after the engine's clone and reset | Rule 2b: skinned roots at the origin, refused otherwise | 6.1.1, 8.3 |
| Clips keyed in Blender `XYZ` are 0.34 rad off today's; `SpinSlash` arms would cross the chest; torso position keys on `Hips` would sink and slide the feet | Quaternion or `XZY` keys; `SpinSlash` exception; only the legs' keys go to `Hips`; foot-height check | 6.1.1, 6.1.5 |
| Clip tracks keep the builder's prefix; clones share `boneInverses`; a skinned shell needs its own culling sphere | Strip tracks per library; shells bound with the bind matrix; shell sphere | 6.1.3, 8.3 |
| The chicken cannot play the biped clips credibly | Posed in code, exempt from the bind rule | 4.6, 6.1.1, 6.1.2 |
| Goblin "target 3" mixes two engine families; guard recount; as-exported ceilings tight | Corrected text; guard accepted; budget note | 6.4, 9.2 |
| The pilot had no stated go/no-go | Six criteria and three outcomes | 10 |
| `Hurt` was added without being asked | Decision N-6, recommended out | 5.7, 6.5, 13 |

### Premise re-check R0 (2026-11-25)

Plan task R0, run against `feat/models-pass` at `0a1d0dc` (main with Stages 4 and 5 merged). Each premise was read in the code at that commit; every amendment was spot-checked before it was applied. Line numbers cited in the amended places now refer to `0a1d0dc`. Result: 8 confirmed, 9 amended. Nothing outside these two documents changed.

| # | Premise | Confirmed or amended | Evidence (file:line) | Where it changed |
|---|---|---|---|---|
| 1 | `MonsterDef` has `model`, `tint`, `modelScale`; lookup, pose and albedo read the model key | Amended (line numbers; tint placement) | `src/data/world.ts` 35-38; `blenderMonsters.ts` 80-81, 89-95, 142-144; `monsterMeshes.ts` 778, 851; `spawns.ts` 66 | Design K2, K4, 6.4, 6.5, 8.1 monsters rows; plan M0, S1, M1, B1, D5 |
| 2 | `facetMaterial` passes extra keys, including `vertexColors`, to the Lambert material | Confirmed | `materials.ts` 197-266; `textures.ts` 264-276; `blenderHero.ts` 156, 176-186 | Plan H6b (the `extra` argument named); design 8.1 role-material row 304-308 |
| 3 | Stage 5's run-time merge touches no figure or gear | Confirmed | `batching.ts` 20, 53-57; callers `blenderWorld.ts` 150, `worldBuild.ts` 608 only | Design 6.4 (one sentence: build-time merge never calls it) |
| 4 | Debug pose hooks in `photo.ts` and the capture method | Amended | `photo.ts` 60-103 (`place` must be a POI, region or `millrace_road`); `tests/photo-poses.test.ts` 23 pins P1-P12; `stage5/capture.md` 39; guards at `worldBuild.ts` 206-207 | Design 7.3; plan V4 (own pose file, additive `x`,`z`, new test) |
| 5 | Stage 4's `blender-hero.test.ts` edit and `new-monsters.test.ts` model-key assertions | Amended (one constraint added) | `blender-hero.test.ts` 135-164; `new-monsters.test.ts` 22-35, 98-105, 131-141; `elvarg_dragon` row at `catalog.ts` 476 | Design 8.3; plan 0.3.9, B1, D4, D5, K3 |
| 6 | The five GLBs hash as before | Amended (hashes recorded; files unchanged) | `sha256sum` at `0a1d0dc` equals `baseline/models/p5-rebuild.md` 69-73; sizes equal design 4.1; last touch `3e2ad8c` | Design 3.2 (hash list); plan R0 item 6, P5 |
| 7 | Dragon and demon pivots still empty | Confirmed | `monsters.glb` JSON chunk; `blenderMonsters.ts` 84, 160-166; `monsterMeshes.ts` 853-859; `loop.ts` 726-729; Ashmantle `world.ts` 170 | None |
| 8 | Figure material and outline assertions in `textures.test.ts`, `dispose.test.ts` | Confirmed | `dispose.test.ts` 53-69; `textures.test.ts` 81-116, 221-233, 355-368, 396-408; plus `facet-light.test.ts` 56-132 | Design 8.3 kept-green list; plan S1b accept |
| 9 | Plan paths exist; `playerMesh.ts` name and offset contracts | Amended (mount row completed, line numbers) | `playerMesh.ts` 95-404, 126-185, 199-222, 230-242, 247-248, 259-272, 280-289, 297-373; `worldBuild.ts` 529-532, 537-585 | Design K2, K4, 6.1.1, 6.1.4, 8.1, 10.3; plan H1 (two loadouts) |
| 10 | No custom normal varying before `skinnormal_vertex` in `facetMaterial` | Amended (resolved: none exists) | `materials.ts` 271-283; `facet-light.test.ts` 70; three r169 `meshlambert.glsl.js` 31, 35, 37 | Design 3.5 S7, 6.1.3 banded-light row; plan S1b |
| 11 | Where Stage 4 applies lean, knock-back, hit stop, flinch, wind-up | Amended (named place) | `loop.ts` 426, 741-773, 954-958; `reactions.ts` 152-186, 285; `monsterMeshes.ts` 816-843; `blenderHero.ts` 125 | Design K4, 6.1.3 reactions row, 6.5; plan M1, M1b |
| 12 | Monster dying state length and drawing | Amended (`Death` fit to 0.85 s; no double fall) | `monsterAi.ts` 98, 557-558; `loop.ts` 706-713; `monsterMeshes.ts` 801-812 | Design 6.5 `Death` rows; plan M1, M1b |
| 13 | Uses of `rig.chest`, `belt`, `neck`, `head`, `hairCap` outside `blenderHero.ts` | Confirmed | `playerMesh.ts` 231; `textures.test.ts` 360-361; `lean-rig.test.ts` 39-42 | Plan H5b (note on `hairCap`) |
| 14 | `mergeByMaterial` or Stage 5's leak test touches figures | Confirmed (no automated leak test exists) | `batching.ts` 20; `worldBuild.ts` 608; `blenderWorld.ts` 150; visual-pass plan G-6 | Design 11.3 T16 wording |
| 15 | `blender-hero.test.ts` lines named in design 8.3 | Confirmed | `blender-hero.test.ts` 39-42, 49, 53-61, 66, 70 | None |
| 16 | File where Stage 4 handles a heavy hit taken; shared with the monster cluster | Amended (named; not shared) | `actions.ts` 511-542 (`performMonsterHeavy`), 449, 544, 568; caller `loop.ts` 690 | Plan 0.4, H5b, second-pass review row |
| 17 | `addCartoonOutline` callers that add a shell mid-pose | Confirmed (only line numbers moved) | `materials.ts` 80-109, 94; `playerMesh.ts` 400; `blenderMonsters.ts` 172 | Design 1 fact 3, K4 |
