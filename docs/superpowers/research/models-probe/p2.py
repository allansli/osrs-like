import sys; sys.path.insert(0, sys.argv[1])
from lib import Doc
p = Doc('/path/to/osrs-like-wp/MP/docs/superpowers/plans/2026-11-14-models-pass-plan.md')
p.between("## Slice 0b: merge-only pass over the monsters (only if D-5)", "## Risks to the plan", r"""## Slice 0b: merge-only pass over the monsters

Kept from the critique (M10) as the cheapest test of whether draw calls hold the frame rate (design 6.4). No shape, no engine change.

### M0 Merge every monster builder's output [AGY]
- **Tier**: sonnet.
- **Depends**: F1, OM-1.
- **Files**: `scripts/blender/build_monsters.py` (one `figkit.merge_parts` call per `Monster_*` root before export), `tests/monster-merge.test.ts` (new, written and committed first by a [CLAUDE] sonnet step: triangles per engine material family per figure equal a fixture computed from today's file by the rule of `blenderMonsters.ts` 103-136; every pivot keeps its meshes' families; meshes per figure at most half today's), `tests/fixtures/monster-families.json` (new), `tests/fixtures/model-contract/monsters.json` (mesh ceilings).
- **Change**: merge only; no geometry, name, pivot or colour change.
- **Accept**: BG for monsters; `monster-merge.test.ts` green against the built file (throw-away worktree); mesh count reported (399 today; the goblin alone went 59 to 29 in design 3.3); CAPTURE(monsters) of the goblin camp beside V4's before.
- **Must not change**: everything but mesh grouping.

### M0p Promote monsters, merge only [CLAUDE, main session] + OM-S0b
- **Tier**: sonnet runs the commands; opus reads the compare report.
- **Depends**: M0.
- **Files**: `public/models/monsters.glb`, `blender/monsters.blend`, `src/engine/blenderMonsters.ts` (the `?v=` key only), `tests/fixtures/model-contract/monsters.json`, `tests/model-cache-key.test.ts` (new: key equals hash prefix for every loader that has one), `docs/superpowers/baseline/models/s0b/`.
- **Change**: BLEND(monsters), COMPARE, promote, set the key. Captures of the start pose and the goblin camp with the perf HUD's draw calls and frame time, before and after.
- **Accept**: SG; the two captures and their numbers committed. Then **OM-S0b**: the owner reads the same two numbers on the real machine. The result is written into the design's review log, whichever way it goes.
- **Must not change**: any other shipped file.

---

## Slice 1: the pilot (one skinned figure, in the game, end to end)

Nothing after this slice starts until **OM-P** accepts the approach.

### S0 Skinned-path tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: R0, P4.
- **Files**: `tests/skinned-figure.test.ts` (new), `tests/fixtures/models/skinned-pair.glb` (new, under 8 kB, written by the test's own helper: one skinned figure of two bones named `probe_Torso` and `probe_LeftArmPivot` and one rigid figure, in one file).
- **Change**: the cases of design 8.3: `two instances cloned from one template pose independently and the template stays at rest`; `bone names lose the model-key prefix on the clone`; `every pivot field the upgrade fills is a Bone`; `the outline shell of a skinned mesh is a SkinnedMesh on the same skeleton and uses the skinned outline material`; `a plain mesh still gets today's shell and today's outline material`; `the skinned outline material is shared and never disposed`; `each skinned mesh has a fixed boundingSphere of at least 1.5 times its rest radius, unchanged after a pose`; `disposeObject3D calls dispose on each skeleton once`; `the rigid figure in the same file takes the rigid path and is unchanged`; `writing rotation.x on a bone moves a vertex weighted to it` (read with `getVertexPosition`).
- **Accept**: red until S1b.
- **Must not change**: `src/`, any existing test.

### S1 Figure kit, part 2: rigs, bodies, weights, clips [AGY]
- **Tier**: sonnet.
- **Depends**: F1.
- **Files**: `scripts/blender/figkit.py`, `scripts/blender/figkit_selftest.py`, `scripts/blender/rigs.py` (new: the three skeleton tables of design 6.1.2 as data: bone, parent, optional flag).
- **Change**: `make_rig(name, table, joints, prefix)`: an armature whose every bone points straight up with roll 0, heads at the given joint positions, named `<prefix>_<Bone>` when a prefix is given. `organic_body(graph, radii, voxel, triangles)`: stick graph, skin modifier, voxel remesh, smooth, decimate, `validate()`. `auto_weights(body, rig, spread_pose)`: builds a limb-aligned twin of the rig with the same names, runs Blender's automatic weights against it, re-binds the body to the world-aligned rig, limits to 4 influences and normalises; if any vertex is unweighted it calls `segment_weights` (distance to each limb segment over the limb's radius, blended across the two nearest) and prints that it did. `hard_weights(part, bone)`: weight 1 on one bone. `fold_weights(mesh, mapping)`: sums a source's vertex groups onto the rig's bones and normalises. `merge_by_family(root, keep=TOGGLED)`: one skinned mesh per engine material family and outline flag (the family rule of `blenderMonsters.ts` 103-136, written once in `figkit.py` and mirrored by `tests/monster-merge.test.ts`'s fixture rule). `make_clip(rig, name, frames, pose_table)`: samples a pose table per frame onto pose bones (`rotation_euler`, mode `XYZ`), one NLA track per clip, clears the active action. `export_glb` gains `export_skins=True`, `export_animation_mode='NLA_TRACKS'`, `export_optimize_animation_keep_anim_armature=False` (rotation-only clips, design 3.5 S3).
- **Accept**: the self-test builds a two-limb skinned figure with one clip and asserts, on the exported file read back in Blender: every joint has identity rotation; no unweighted vertex; at most 4 influences; the clip has rotation channels only; a part given `hard_weights` has weight 1 on its bone; exits 0 inside 60 s under CAP. SG; UNTOUCHED.
- **Must not change**: the four build scripts; `merge_parts` and `bake_paint`.

### S1b The skinned path in the engine [AGY]
- **Tier**: sonnet; opus verify reads the shader text against design 6.1.3 and R0 item 10.
- **Depends**: S0.
- **Files**: `src/engine/skinned.ts` (new, under 120 lines: `hasSkin(node)`, `cloneFigure(node)` using `SkeletonUtils.clone` from `three/examples/jsm/utils/SkeletonUtils.js`, `stripBonePrefix(root, key)`, `fixCullSpheres(root, factor = 1.5)`), `src/engine/materials.ts` (`addCartoonOutline`: for a `SkinnedMesh`, a `SkinnedMesh` shell bound with `shell.bind(mesh.skeleton, mesh.bindMatrix)` and a skinned variant of the outline material, cached under its own key, whose vertex shader includes `skinning_pars_vertex`, `beginnormal_vertex`, `skinbase_vertex`, `skinnormal_vertex`, `begin_vertex`, `skinning_vertex` and uses `transformed` and `objectNormal`; `facetMaterial`: only if R0 item 10 found a normal written before the skin, move it after `skinnormal_vertex`), `src/engine/dispose.ts` (dispose each `SkinnedMesh`'s skeleton once), `src/engine/blenderMonsters.ts` (`upgradeMonsterRigWithGltf`: if `hasSkin(template)`, `cloneFigure`, `stripBonePrefix`, the same material rules, `fixCullSpheres`; otherwise today's path, untouched).
- **Change**: as design 6.1.3. No list of skinned figures anywhere: the file decides.
- **Accept**: `ONE(tests/skinned-figure.test.ts)` passes; `ONE(tests/textures.test.ts)`, `ONE(tests/dispose.test.ts)`, `ONE(src/__tests__/lean-rig.test.ts)` and `ONE(src/__tests__/blender-hero.test.ts)` pass untouched; SG (the JS chunk grows by the clone utility; BUILD reports it against Stage 5's cap).
- **Must not change**: the rigid path; the plain outline material and its uniforms; material choice by name; `poseMonsterLimbs`.

### S2 The pilot figure: goblin raider, rebuilt and skinned [CLAUDE]
- **Tier**: **fable** (the rig, body route and weight rules eight more figures follow); opus verifies.
- **Depends**: S1, M0p.
- **Files**: `scripts/blender/build_monsters.py` (the goblin raider's builder only), `tests/fixtures/model-contract/monsters.json` (the goblin's entry replaced whole: biped skeleton, bones `goblin_<Bone>`, skinned-mesh and wire ceilings).
- **Change**: to design section 5 and 4.6: hunched line of action, big ears and jaw, one tapered torso, the spear and shield outside the outline and hard-weighted to `WeaponPivot` and `OffhandPivot`, olive at 30 to 45% value with a bone and rust accent, optional `Jaw`. Bind pose is the rest pose with every bone at identity (design 6.1.1). 5,000 triangles. **Built two ways** (design 6.2): (a) `organic_body` from a stick graph; (b) today's primitives fused by a voxel remesh; the same head, gear, palette and rig on both. **Each built in two material variants** for decision N-4: up to three families, and one material with the colours in the paint layer. `bake_paint` on all.
- **Accept**: BG for each build; `tests/monster-merge.test.ts`'s goblin fixture replaced by this task (declared: the figure is new); turnaround, silhouette, play-distance and **worst-pose** sheets of both routes `--against` shipped under `docs/superpowers/baseline/models/s1/`; **measured Brotli bytes of the figure for each build, and the per-figure wire ceilings of design 9.1 reset from them**; a short written pattern (what was done, in order, with the kit calls and the weight rules that were needed) appended to `docs/superpowers/baseline/models/README.md`.
- **Must not change**: `Monster_goblin`; the names `goblin_HeadGroup`, `goblin_LeftArmPivot`, `goblin_RightArmPivot`, `goblin_LeftLegPivot`, `goblin_RightLegPivot` and their positions within 0.05; material name substrings; in-game height within 5%; every other builder (their Drift is zero).

### S3 The pilot in the game [CLAUDE, main session]
- **Tier**: sonnet runs; opus reads.
- **Depends**: S1b, S2.
- **Files**: `docs/superpowers/baseline/models/s1/ingame/` (new), `docs/superpowers/baseline/models/s1/README.md`.
- **Change**: CAPTURE(monsters) for each of the four builds at the goblin camp, with the skinned raider beside the still-rigid archers: standing, walking, mid-attack, mid-flinch and holding Stage 4's wind-up pose (all driven by today's `poseMonsterLimbs` on bones); the outline turned on; noon and dusk (a bent arm in light and in shadow, the check of design 6.1.3's banded-light row); the figure at the screen edge and half off it (culling); its shadow on the ground; after 30 kills and respawns, `renderer.info.memory` beside the value before (the leak check). The perf HUD's draw calls and frame time at the camp, beside M0p's.
- **Accept**: the captures and numbers committed; any fault found is fixed by a follow-up task before OM-P.
- **Must not change**: anything shipped.

### OM-P [OWNER]
Play beside the pilot on a real GPU. Choose route (a) or (b); answer N-4 (one material or up to three). **Accept the approach or stop it.** This sets the pattern for every figure; a change here is cheap, later it is not.

### S4 Promote monsters with the pilot [CLAUDE, main session]
- As M0p (same tier, files, accept and must-not-change), sheets under `s1/`. **Depends**: OM-P. From here on the shipped game has one skinned monster among rigid ones.

### Q1 Eight-bit attributes in the promote step [CLAUDE] test, then [AGY] (only if N-3)
- **Tier**: sonnet for both.
- **Depends**: S4, P3.
- **Files**: `tests/model-pack.test.ts` (new, first), `scripts/lib/glb-pack.mjs` (new, plain node, no dependency), `scripts/models-promote.mjs`.
- **Change**: test: `normals become normalised signed bytes and the file lists KHR_mesh_quantization as used and required`; `weights and colours become normalised unsigned bytes and each vertex's weights still sum to 255`; `positions, joints, indices and animation data are byte-identical`; `the bare GLTFLoader parses the packed file`; `every posed vertex of the packed fixture is within 0.001 of the unpacked one`; `a file with no skin and no colour only has its normals packed`; `packing twice changes nothing`. Then the script (the method of design 3.5 S10) and its call inside promote for `hero` and `monsters` only; Contract and Budget are checked on the packed file.
- **Accept**: `ONE(tests/model-pack.test.ts)` passes; the pilot promoted again shows about 30% fewer wire bytes for the goblin; `ONE(src/__tests__/blender-hero.test.ts)` passes untouched against a packed `monsters.glb`; SG.
- **Must not change**: `gear.glb`, `world.glb` (the engine reads their positions in metres and their merge path was not measured); the build scripts.

---

## Slice 2: hero

### H1 Hero acceptance tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: OM-P.
- **Files**: `tests/hero-model.test.ts` (new), `tests/gear-mount.test.ts` (new), `tests/fixtures/hero-mounts.json` (new: for a full ten-slot loadout mounted on **today's** hero by today's `rebuildPlayerEquipmentMeshes` logic, the rest position of every mounted piece in the rig group's space, and which meshes are hidden; written by a helper in this task, before anything changes).
- **Change**: `hero-model`: rotation range per clip as the critique's E4 measured it: `every attack clip turns Torso by at least 0.3 rad` (today `Lunge` 0.24 and `Cast` 0.12 fail); `Idle turns Torso or HeadGroup by at least 0.08 rad` (today 0.03); `Walk turns Torso by at least 0.08 rad` (today 0.04); `Fish turns an arm by at least 0.3 rad` (today 0.10); `in Slash, Lunge, Chop and Mine the right arm's x rotation first moves against the strike` (`Lunge` fails today); `Walk bends each knee bone by at least 0.3 rad and Slash bends the right elbow by at least 0.3 rad` (new with skinning); `the hero is skinned on the biped skeleton with the bone list of design 6.1.2`; `Hair, TorsoCoat and InnerCollar exist as their own meshes`; `shared clips have rotation tracks only, plus Hips position`; `triangles at most 6,000, meshes at most 11`; `meshes carry COLOR_0`; and the two frozen samples restated so they fail here first: `0.2 s into Walk a leg bone's x rotation exceeds 0.01` and `0.15 s into Slash at time scale 1.2 the right arm's x rotation exceeds 0.05`. `gear-mount`: `every mounted piece's rest position in the rig group's space is within 0.01 of the fixture`; `a helm hides every Hair* mesh; body armour hides TorsoCoat and InnerCollar`; `armour recolours the role materials on the meshes that carry them`.
- **Accept**: `gear-mount` passes on today's hero; `hero-model` is red in the cases named and in every skin case; the task records the actual red list in the test file's header.
- **Must not change**: `src/`, any existing test.

### H2 One mounting function [AGY]
- **Tier**: sonnet.
- **Depends**: H1.
- **Files**: `src/engine/playerMesh.ts`, `src/engine/worldBuild.ts` (the merchants' hat).
- **Change**: the mounting part of `rebuildPlayerEquipmentMeshes` (offsets, hide loops, recolouring) moves, unchanged, into an exported `mountLoadout(rig, items)`; the player calls it; the merchant's hat is mounted through it instead of its own copy of the helm offset (`worldBuild.ts`, `createMerchantNPC`).
- **Accept**: `ONE(tests/gear-mount.test.ts)` passes; `ONE(src/__tests__/blender-hero.test.ts)` passes untouched; SG.
- **Must not change**: any offset, any hide rule, any colour.

### H3a Hero skin: author's weights on the biped rig, clips on bones [CLAUDE]
- **Tier**: opus (fable if rejected once at the owner step).
- **Depends**: H1, S1.
- **Files**: `scripts/blender/build_hero.py`, `tests/fixtures/model-contract/hero.json` (the hero's entry replaced whole and **declared**: the flat pivot layout becomes the chain `Root`, `Hips`, `Torso`, `HeadGroup` and arms, legs under `Hips`; `HeadGroup` moves from 1.86 to the source's neck joint; design 8.1).
- **Change**: keep the source's `Armature` instead of deleting it (`build_hero.py` 439-443 today removes it); `fold_weights` its 59 groups onto the 16 biped bones (the mapping of design 3.5 S13); pose the source armature to arms down, legs straight, and apply it to the meshes so that pose is the bind pose; scale and place as today (1.85 tall, soles at 0); `make_rig` with joints at the `LEAN_RIG` positions for shoulders (±0.28, 1.50), elbows, hips (±0.11, 0.90) and knees, `Torso` at 1.24; meshes joined by engine role into at most 11 (design 6.1.4), with `Hair` and the eyes left rigid on the head bone and `TorsoCoat` and `InnerCollar` as their own skinned meshes; `extras.part` kept on each. The ten clips are keyed by today's sample functions onto pose bones of the same names through `make_clip` (position keys only on `Hips`), unchanged in timing. No clip is improved here.
- **Accept**: BG for hero; in a throw-away worktree with the built file and H5 and H5b applied, `ONE(src/__tests__/blender-hero.test.ts)` is green; the skin cases of `hero-model` are green against the built file; turnaround `--engine-palette`, **worst-pose** and motion strips of `Walk`, `Slash` and `Chop` `--against` the shipped file under `docs/superpowers/baseline/models/s2/`, with every seam between two skinned meshes shown in a bend; CAPTURE(hero) of the two hero poses, undressed and in the plate set. If the arms-down re-pose damages the weights (design 14), the fallback is recorded and used: bind in the source pose and add the arm-down rotation to every clip.
- **Must not change**: shoulder, elbow, hip and knee joint positions; every `extras.part` value and mesh name the engine reads or toggles (design 8.1); hand, foot and head centres beyond 0.01; clip names and lengths; the body's bounds beyond 3% per axis; the CC-BY source and its credit.

### H3b Hero face, hands, hair, paint [CLAUDE]
- **Tier**: opus.
- **Depends**: H3a.
- **Files**: `scripts/blender/build_hero.py`, `tests/fixtures/model-contract/hero.json`.
- **Change**: to design 5.2 to 5.4: hands 15% larger **about their own centre** (the mount offsets hold); the face given planes that read at 260 px (brow, nose, jaw; eyes kept as their own meshes); hair as three or four large locks, still named `Hair*`; `bake_paint`.
- **Accept**: BG; turnaround and silhouette sheets `--engine-palette --against` the shipped file under `s2/`; `ONE(tests/gear-mount.test.ts)` green against the built file; a turnaround of the built body wearing today's plate set showing no hand, hair or limb poking through and no floating glove or boot, at rest and in the worst pose; CAPTURE(hero).
- **Must not change**: as H3a.

### H4 Hero motion: the biped library [CLAUDE]
- **Tier**: opus.
- **Depends**: H3a.
- **Files**: `scripts/blender/build_hero.py`, `tests/fixtures/model-contract/hero.json` (clips: the two frozen samples, each attack clip's anticipation time, `Death` and `Hurt`).
- **Change**: design 6.5, smooth only: sample functions become pose tables on a twelve-a-second grid sampled per frame; elbow and knee bends added to every clip; the clips H1 marks weak improved (`Idle`, `Walk` torso counter-rotation and a level head, `Fish`, `Lunge` wind-back, `Cast` torso lead); attack clips otherwise kept, since they already have three beats (critique C2); `Death` (1.1 s, ends lying, last pose held) and `Hurt` (0.35 s) added. Clip lengths within 10% of today's.
- **Accept**: BG; every `hero-model` motion case green against the built file, including the two frozen samples; motion strips for all twelve clips under `s2/`; the opus verify names the frame of each of the three beats in every attack strip; CAPTURE(hero) walking, striking and falling.
- **Must not change**: the ten clip names; the two frozen samples; clip lengths beyond 10%; rotation-only tracks except `Hips`.

### H5 Declared replacements and clip tests [CLAUDE]
- **Tier**: sonnet; opus verify compares the diff of the frozen file with design 8.3 word for word.
- **Depends**: H3a (so the replaced assertions can be run against a built file).
- **Files**: `src/__tests__/blender-hero.test.ts` (**the two declared replacements and nothing else**: lines 39-42 become "the ten names are all present, and the full sorted list equals the manifest's hero clips"; lines 56-57 become "the height of `rig.torso` in the rig group's space is `LEAN_RIG.torsoY` to two decimals, and the height of `rig.headGroup` in the same space equals the manifest's neck height to two decimals"), `tests/hero-clips.test.ts` (new).
- **Change**: `hero-clips`: `Death plays once and clamps on the last pose`; `finishRespawn returns to Idle`; `Hurt plays only when no one-shot is active`; `a running attack is never interrupted by Hurt`; `Stage 4's torso lean and knock-back offsets are still applied while a clip plays` (read from the rig after one update); `two hero instances (the player and a merchant) pose independently`.
- **Accept**: the frozen file's diff is exactly those two hunks; with today's shipped hero the replaced clip-list assertion and the two height assertions pass (the manifest still lists ten clips and the flat heights until H7); `hero-clips` is red until H5b.
- **Must not change**: every other line of `blender-hero.test.ts`, including 58-61, 66 and 70.

### H5b The hero on the skinned path [AGY]
- **Tier**: sonnet.
- **Depends**: H5, H2, S1b.
- **Files**: `src/engine/blenderHero.ts` (`upgradeHumanoidRigWithGltf`: `cloneFigure` when the file has a skin; material assignment by `extras.part` and mesh name unchanged; `HeroClipName` gains `Death` and `Hurt`), `src/engine/playerMesh.ts` (`mountLoadout`: the two hide loops search `rig.group`; the helm and hat offset reads the head joint's height so today's rigid hero and the skinned one both place the helm where the fixture says), `src/engine/actions.ts` (`handlePlayerDeath` plays `Death`; `finishRespawn` returns to `Idle`), the engine file where Stage 4 handles a heavy hit taken (named by R0: requests `Hurt`, dropped if a one-shot is active).
- **Change**: as design 6.1.3 and 6.1.4. The loader takes the skinned path only when the file has a skin, so this lands before the hero file is promoted.
- **Accept**: `ONE(tests/hero-clips.test.ts)`, `ONE(tests/gear-mount.test.ts)` and `ONE(src/__tests__/blender-hero.test.ts)` pass against today's file **and**, in a throw-away worktree, against the built one; SG.
- **Must not change**: Stage 4's timings in `feel.ts`; respawn timing; the death overlay; any mount offset other than the helm's and hat's.

### H7 Promote hero [CLAUDE, main session] + OM-S2
- **Tier**: sonnet runs the commands; opus reads the compare report and the sheets.
- **Depends**: H3b, H4, H5b, H6b.
- **Files**: `public/models/hero.glb`, `blender/hero.blend` (CALL-M10), `src/engine/blenderHero.ts` (the `?v=` key only), `tests/fixtures/model-contract/hero.json` (ceilings lowered to the built values plus 2%), `docs/superpowers/baseline/models/s2/`.
- **Change**: BLEND(hero), COMPARE, promote (packed if N-3), set the key, SHEETS `--against` the old file, in-engine captures of the two hero poses, of a merchant, and of the hero in a full plate set mid-swing.
- **Accept**: SG; `ONE(tests/hero-model.test.ts)` fully green; wire size of `hero.glb` at most 200,000 (150,000 if N-3); sheets at most 2 MB. Then **OM-S2**.
- **Must not change**: any other file under `public/models/` or `blender/`.

---

## Slice 3: gear merge and guards

Gear bands, gear to budget and bending gear moved to the follow-up stage (decision N-2).

### G2 Merge test [CLAUDE]
- **Tier**: sonnet.
- **Depends**: P4.
- **Files**: `tests/gear-merge.test.ts` (new), `tests/fixtures/gear-families.json` (new: triangles per engine material family per node, computed from today's file by the rule of `blenderGear.ts` 93-116).
- **Change**: for every `Gear_*` node of the shipped file, triangles per material family equal the fixture; meshes per node at most 4, except nodes whose fixture has more than 4 families.
- **Accept**: the family case passes today; the mesh-count case is red until G6.
- **Must not change**: `src/`.

### G2b Merge gear meshes [AGY]
- **Tier**: sonnet.
- **Depends**: G2, F1.
- **Files**: `scripts/blender/build_gear.py` (one call per root before export).
- **Change**: call `figkit.merge_parts` on every `Gear_*` root (toggled names and `_04_` ordinals kept, F1). Gear stays rigid.
- **Accept**: BG for gear; `gear-merge.test.ts` green against the built file (throw-away worktree); `ONE(src/__tests__/blender-hero.test.ts)` and `ONE(tests/gear-mount.test.ts)` green there too; mesh count reported (506 today); CAPTURE(gear) of the hero in a full plate set and in the bandos set (projected albedo tiles shift on merged parts, critique M2).
- **Must not change**: geometry, node names, materials, mount space.

### G6 Promote gear, merge only [CLAUDE, main session]
- As H7 for `gear.glb` (`src/engine/blenderGear.ts`, the `?v=` key only); wire size at most 690,000; `gear-merge.test.ts` fully green. **Depends**: G2b, H7.

### N1 Guard tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: G6.
- **Files**: `tests/guards.test.ts` (new).
- **Change**: `createCastleGuard` produces, for both guards: the same position, the same `npcList` label and dialogue text, a hitbox of the same size, `userData` keys unchanged (values read from today's code and written into the test), a rig flagged `isBlenderHero` once the hero template resolves, its own skeleton (posing one guard does not move the other or the player), and no request for `guard.glb` (the loader stub records URLs); meshes per guard at most 35.
- **Accept**: red until N2.
- **Must not change**: `src/`.

### N2 Guards from the hero and gear [AGY]
- **Tier**: sonnet.
- **Depends**: N1.
- **Files**: `src/engine/worldBuild.ts`, `public/models/guard.glb` (delete), `scripts/blender/export_guard.py` (delete), `scripts/run-blender.mjs` and `package.json` (remove the guard mode), `tests/fixtures/model-contract/guard.json` (delete) and `totals.json`, `tests/model-pipeline.test.ts` (the one `guard is a mode` case, created by this plan, removed).
- **Change**: design 10.3. `loadBlenderGuardTemplate` is deleted. The guard is built the way the merchant is, dressed through `mountLoadout` with the full helm, plate body, plate legs, kite shield and sword visuals in guard steel `0x80898f` with gold trim, and plays `Idle`. No mount offset is copied.
- **Accept**: `ONE(tests/guards.test.ts)` passes; `test ! -e public/models/guard.glb`; `ONE(tests/credits.test.ts)` green untouched; SG.
- **Must not change**: guard positions, dialogue, hitbox, labels; the player's mounted offsets.

### N3 Credits, the knight's source, capture [CLAUDE] + OM-S3
- **Tier**: sonnet.
- **Depends**: N2.
- **Files**: `CREDITS.md`, `blender/examples/knight_28541/knight.blend` (**delete**; owner decision D-3 of 2026-11-14), `blender/examples/knight_28541/LICENSE.txt` (its "Used by" lines updated; the file stays), `docs/superpowers/baseline/models/s3/`.
- **Change**: move the knight's row to a "source removed; credit kept" part, keeping the words `tests/credits.test.ts` reads. In-engine capture of `model-guards`, with the perf HUD's draw calls at the gate before and after.
- **Accept**: `ONE(tests/credits.test.ts)` and `ONE(tests/model-licences.test.ts)` pass; SG. Then **OM-S3**.
- **Must not change**: every other credit row; the other licence files.

---

## Slice 4: monsters on clips; dragon, Ashmantle, demon

### M1 Motion tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: H7 (the biped library), R0 items 11 and 12.
- **Files**: `tests/monster-motion.test.ts` (new).
- **Change**: `every model key has a motion row`; `a row without clips reproduces the old branch's pivot rotations and body lift at progress 0, 0.5 and 1` (the numbers of `monsterMeshes.ts` 813-843 written into the test); `every bone a row names exists on that model's skeleton and has weight on at least one vertex` (skipped by name for models that are still rigid); `the goblin plays the hero file's Walk and Slash: a leg bone turns, and every bone keeps its own rest translation`; `the Hips position track is scaled by the model's hip height over the hero's`; `while winding up, the attack clip's time is progress times its anticipation time and it does not advance on its own`; `on release it plays to the end`; `Stage 4's lean, flinch and knock-back offsets are present on the bones after the animator's update`; `hit stop: the animator does not advance during the frozen time`; `a model whose row names Death plays it within the dying state's length` (R0 item 12); `the table imports nothing from three`.
- **Accept**: red until M1b.
- **Must not change**: `src/`.

### M1b Motion table and the monster animator [AGY]
- **Tier**: sonnet; opus verify.
- **Depends**: M1.
- **Files**: `src/data/monsterPoses.ts` (new, pure: per model key either today's code-pose numbers or the names of the clips for idle, walk, attack, hurt and death, the skeleton it stands on and an optional arm-swing scale), `src/engine/monsterMeshes.ts` (`poseMonsterLimbs` reads the table; for a row with clips it drives an animator instead), `src/engine/blenderMonsters.ts` (on upgrade, a model whose row names clips gets a `BlenderHeroAnimator` over the library of its skeleton: the hero file's clips for bipeds, `monsters.glb`'s for the others; the `Hips` track scaled once per model key and cached), `src/engine/loop.ts` (the animator's update, after which Stage 4's offsets are applied at the place R0 item 11 names).
- **Change**: design 6.1.3 and 6.5. The goblin raider's row names `Idle`, `Walk`, `Slash`, `Hurt`, `Death`; every other row keeps today's numbers until its figure is rebuilt.
- **Accept**: `ONE(tests/monster-motion.test.ts)` passes; SG; CAPTURE at the goblin camp of the raider walking, winding up, striking and dying with the hero's clips, beside the still-rigid archers. This capture goes to the owner with OM-S4, and earlier on request: it is where reuse first shows.
- **Must not change**: flinch, walk and idle numbers of code-posed rows; Stage 4's reaction timings; the seven existing pivot fields of the rig; any rule (`src/state/`).

### B1 Look fields `kit` and `body` [CLAUDE] test, then [AGY]
- **Tier**: sonnet for both.
- **Depends**: R0, S1b.
- **Files**: `tests/monster-kits.test.ts`, `tests/monster-body.test.ts` (new, written and committed first), then `src/engine/blenderMonsters.ts`, the file holding `MonsterDef` (named by R0; two optional look fields), the engine call site that passes the def (named by R0).
- **Change**: tests: `a def with kit clones its model's Monster_ node, then adds the children of Kit_<kit> under the bones of the same name (a child named after no bone goes under the root)`; `a def with body clones Monster_<body> instead of Monster_<model key>, and its skeleton, motion row, albedo and minimap entry still come from the model key`; `a def with neither is unchanged`; `the model keys of every row equal a snapshot, so Stage 4's tests over model keys still see ten`. Then the implementation, in `upgradeMonsterRigWithGltf` only.
- **Accept**: both tests pass; Stage 4's amended `blender-hero.test.ts` and `new-monsters.test.ts` pass untouched; SG.
- **Must not change**: material rules; Stage 4's `tint`, `modelScale` and `model`.

### D2 The new dragon [CLAUDE]
- **Tier**: **fable** (the hardest shape here, and it defines the dragon skeleton); opus verifies.
- **Depends**: S4, B1.
- **Files**: `build_monsters.py` (the dragon builder, rewritten; the old one and its use of `Dragon-low-rig.blend` removed), `tests/fixtures/model-contract/monsters.json` (the dragon's entry replaced whole: the dragon skeleton of design 6.1.2, bones `elvarg_dragon_<Bone>`).
- **Change**: an original dragon to design section 5 (design K7: no replica of any game's dragon): a low, heavy-shouldered body with a clear line of action, a long neck in two bones, a wedge head with a jaw, horns swept back, four legs outside the body outline, wings whose membrane is its own material, a tail in three bones. Hide, belly, membrane and horn at different values; one glow (the mouth). `organic_body` for trunk, neck, legs and tail; wings and horns built and hard- or blend-weighted by rule; `auto_weights` in a spread pose. 14,000 triangles, at most 4 skinned meshes. Not painted before OM-S2 has accepted the paint layer on the hero.
- **Accept**: BG; turnaround, silhouette, play-distance and worst-pose sheets (neck curled, wings raised and folded, jaw open, tail swept) `--against` shipped under `s4/`; wire bytes of the figure reported against 320 kB (220 kB if N-3); CAPTURE(monsters) at the dragon's lair. If two attempts fail the opus verify's reading of the sheets, the task stops and goes to the owner with the fallback of design 6.2 item 3 (a CC0 or CC-BY rigged base, or the old mesh with its own armature folded onto the dragon rig).
- **Must not change**: `Monster_elvarg_dragon`; the names `elvarg_dragon_HeadGroup`, `_LeftArmPivot`, `_RightArmPivot`, `_LeftLegPivot`, `_RightLegPivot`, `_LWing`, `_RWing`; its in-game size within 5%; the old dragon's source file and licence note under `blender/examples/` (its credit row moves to "not shipped" at D5).

### D2b The dragon library [CLAUDE]
- **Tier**: opus.
- **Depends**: D2, M1b.
- **Files**: `build_monsters.py` (clips on the dragon's armature), `src/data/monsterPoses.ts` (the dragon's row names its clips; **declared**: this replaces the dragon row of M1's "reproduces the old branch" case, whose numbers were never seen on a mesh because the old pivots were empty, critique C1), `tests/monster-motion.test.ts` (that one row), manifest (clips, anticipation times).
- **Change**: `Idle`, `Walk`, `Bite`, `WingBuffet`, `Hurt`, `Death`, as pose tables, rotation-only plus `Hips`.
- **Accept**: BG; `monster-motion.test.ts` green for the dragon against the built file; motion strips under `s4/`; CAPTURE(monsters) of the dragon walking, winding up `WingBuffet` under Stage 4's telegraph, biting and dying.
- **Must not change**: as D2; Stage 4's attack rows and timings.

### D3 Ashmantle, its own body [CLAUDE]
- **Tier**: opus.
- **Depends**: D2b.
- **Files**: `build_monsters.py` (a new builder), manifest (node `Monster_ashmantle` on the dragon skeleton, bones `ashmantle_<Bone>`, no clips of its own).
- **Change**: design 5.6: heavier chest, a slag crown fused to the skull, back plates with emissive seams (the `glow` material), a clubbed tail end; ash and ember values at least 15 points from the dragon's. 12,000 triangles, at most 4 skinned meshes. Value and size stay Stage 4's `tint` and `modelScale`.
- **Accept**: BG; silhouette sheet of dragon and Ashmantle side by side (Ashmantle at `modelScale` 1.2) at 85 px: different outlines; worst-pose sheet; `monster-motion.test.ts`: Ashmantle plays the dragon's `Walk` and `Bite`; wire bytes against 275 kB (190 kB if N-3); CAPTURE(monsters) at Ashmantle's arena.
- **Must not change**: the dragon's node; every other builder.

### M3d Lesser demon, rebuilt [CLAUDE]
- **Tier**: opus.
- **Depends**: D3 (same file, serial).
- **Files**: `build_monsters.py` (the demon builder, rewritten; the old one and its use of `RedDevil-Ex.blend` removed), manifest (entry replaced whole: biped skeleton with `LWing`, `RWing`, `TailPivot`, `TailPivot2`), `src/data/monsterPoses.ts` (the demon's row names biped clips).
- **Change**: an original demon on the biped rig: a forward hunch, horns and wings exaggerated, wings centred on the back, the cleaver hard-weighted to `WeaponPivot`, slate and ember values. 7,000 triangles.
- **Accept**: BG; `monster-motion.test.ts` green for the demon; turnaround, worst-pose and silhouette sheets under `s4/`; CAPTURE(monsters) at the pass. Fallback as design 4.6: the CC0 body kept, with its author's weights folded onto the biped rig.
- **Must not change**: `Monster_lesser_demon`, its seven pivot names as bones, in-game height within 5%; the source file and its licence note.

### D4 Model, body and kit test [CLAUDE]
- **Tier**: sonnet.
- **Depends**: D3.
- **Files**: `tests/monster-models.test.ts` (new).
- **Change**: `every MONSTER_TYPES row's model key (or type key) has a Monster_ node with both leg bones or pivots`; `every row's body, if any, has a Monster_ node on the same skeleton as its model`; `every row's kit, if any, has a Kit_ node whose children name bones of that model`; `no row's stats or model key differ from a snapshot taken in this test` (name, level, hitpoints, max hit, attack, defence, drops, model).
- **Accept**: red for the body until D5, for the two kits until K3.
- **Must not change**: `src/`.

### D5 Give the boss its body; promote [AGY], then [CLAUDE, main session] + OM-S4
- **Tier**: sonnet; opus reads the report and the sheets.
- **Depends**: D2b, D3, M3d, D4.
- **Files**: the file holding Stage 4's Ashmantle row (named by R0): `body: 'ashmantle'` and nothing else; then as M0p for `monsters.glb`; `CREDITS.md` (the old dragon's and the Red Devil's rows move to "kept in the repository, not shipped"); sheets under `s4/`.
- **Accept**: TYPES; D4's body case green; Stage 4's tests pass untouched; SG; captures of both lairs and the pass; `ONE(tests/credits.test.ts)` and `ONE(tests/model-licences.test.ts)` green. Then **OM-S4**.
- **Must not change**: every other field, including `model`, `tint` and `modelScale`; every other row; any other shipped file.

---

## Slice 5: start region

### M3a Goblin archer rebuilt, chicken re-rigged [CLAUDE]
- **Tier**: opus.
- **Depends**: D5.
- **Files**: `build_monsters.py` (those two builders), manifest, `src/data/monsterPoses.ts` (rows name biped clips; the archer attacks with `Ranged`).
- **Change**: archer: the raider's rig and proportions with its own head (ears through the hood), a lighter value, the bow hard-weighted to `OffhandPivot` and held out to the side, a tall quiver. Chicken: today's shape kept, its parts fused into at most 3 skinned meshes on the biped rig (wings on the arm bones, hard weights on beak and comb), 2,500 triangles.
- **Accept**: BG; sheets under `s5/`; the roster silhouette sheet shows raider and archer told apart at 85 px; `monster-motion.test.ts` green for both; CAPTURE(monsters) at the goblin camp and the chicken yard.
- **Must not change**: the two node names, their pivot names as bones and positions within 0.05, material name substrings, in-game height within 5%; every other builder.

### M4a Promote monsters, slice 5 [CLAUDE, main session] + OM-S5
- As M0p, sheets under `s5/`; the untouched figures show zero Drift. **Depends**: M3a.

---

## Slice 6: mid game and variants

### M3b Scorpion on the crawler rig, with its library [CLAUDE]
- **Tier**: opus.
- **Depends**: M4a.
- **Files**: `build_monsters.py` (the scorpion builder), manifest (crawler skeleton, clips), `src/data/monsterPoses.ts` (the scorpion's row; **declared** as D2b: it replaces that row of M1's old-numbers case).
- **Change**: today's design kept: plates hard-weighted to their bones, legs at least 0.044 thick with per-leg bones, a tail of three bones, ochre and bone values, 5,000 triangles, at most 3 skinned meshes. Library: `Idle`, `Walk`, `Strike`, `Hurt`, `Death`.
- **Accept**: BG; sheets and motion strips under `s6/`; `monster-motion.test.ts` green; CAPTURE(monsters) at the dunes.
- **Must not change**: as M3a, for the scorpion.

### M3e Dark wizard and dark ranger, rebuilt [CLAUDE]
- **Tier**: opus.
- **Depends**: M3b (same file, serial).
- **Files**: `build_monsters.py` (those two), manifest, `src/data/monsterPoses.ts`.
- **Change**: wizard: hat and sleeves exaggerated, a robe skirt weighted by rule to `Hips` and the leg bones so it swings without clinging, the staff hard-weighted to `WeaponPivot` and held away from the body; attacks with `Cast`. Ranger: a cloak that makes a triangle outline, weighted to `Torso` and `Hips`, bow out, a value clearly lighter than the wizard's; attacks with `Ranged`.
- **Accept**: BG; sheets under `s6/`, the worst-pose sheet showing the skirt and cloak in a stride and a strike; the three told apart from each other and from the goblins on the roster sheet; CAPTURE(monsters).
- **Must not change**: as M3a, for these two.

### K1 Saltback Stalker kit [CLAUDE]
- **Tier**: opus.
- **Depends**: B1, M3b.
- **Files**: `build_monsters.py`, manifest (node `Kit_saltback_stalker`).
- **Change**: design 5.6: salt-crusted back plates, a forked double sting, heavier claws, each a rigid child named after the scorpion bone it rides on; at most 1,200 kit triangles; values 15 points from the scorpion's.
- **Accept**: BG; scorpion and stalker side by side at 85 px: different outlines.
- **Must not change**: `Monster_scorpion`; every other builder.

### K2 Thornwatch Marksman kit [CLAUDE]
- **Tier**: opus.
- **Depends**: K1, M3e.
- **Files**: `build_monsters.py`, manifest (node `Kit_thornwatch_marksman`).
- **Change**: a thorn-wreathed hood, a tall bramble quiver, a longer bow; at most 1,200 kit triangles.
- **Accept**: BG; ranger and marksman side by side at 85 px: different outlines.
- **Must not change**: `Monster_dark_ranger`; every other builder.

### K3 Give the two rows their kits [AGY]
- **Tier**: sonnet.
- **Depends**: K2, D4.
- **Files**: the file(s) holding Stage 4's two variant rows (named by R0).
- **Change**: `kit` becomes `saltback_stalker` and `thornwatch_marksman`. Nothing else.
- **Accept**: TYPES passes; the snapshot of D4 passes (stats and model keys unchanged); Stage 4's tests pass untouched.
- **Must not change**: every other field, including `model`, `tint` and `modelScale`; every other row.

### K4 Promote monsters, slice 6 [CLAUDE, main session] + OM-S6
- As M0p, sheets under `s6/`. **Depends**: K3.

---

## Slice 7: late game

### M3c Hill giant and moss guardian, re-rigged [CLAUDE]
- **Tier**: opus.
- **Depends**: K4.
- **Files**: `build_monsters.py` (those two), manifest, `src/data/monsterPoses.ts`.
- **Change**: giant: today's parts fused into one skin (the stacked-ball joints go), shoulders and hands exaggerated, the club hard-weighted to `WeaponPivot` and carried at the side; its row may scale the arm swing so the arms clear the belly. Guardian: stone and bark blocks hard-weighted (stone does not bend), separated in value by 20 points, the core kept as the one glow.
- **Accept**: BG; sheets under `s7/`; `monster-motion.test.ts` green; CAPTURE(monsters).
- **Must not change**: as M3a, for these two.

### M4c Promote monsters, slice 7 [CLAUDE, main session] + OM-S7
- As M0p, sheets under `s7/`; the roster silhouette sheet holds every figure, all told apart (GM6). **Depends**: M3c.

---

## Slice 8: one path, budgets, hand-off

### X0 Remove the rigid monster path [AGY]
- **Tier**: sonnet.
- **Depends**: M4c.
- **Files**: `src/engine/blenderMonsters.ts`, `src/data/monsterPoses.ts` (rows without clips removed), `src/engine/monsterMeshes.ts` (the code-pose branch of `poseMonsterLimbs` stays only for the procedural placeholder rigs), `tests/skinned-figure.test.ts` (the rigid-in-the-same-file case, created by this plan, now asserts a rigid `Monster_` node is refused with a console warning), `tests/monster-motion.test.ts` (the old-numbers case, created by this plan, removed).
- **Change**: `upgradeMonsterRigWithGltf` requires a skin. The hero's loader keeps both branches (rigid hair and eyes are children of a bone, not a path).
- **Accept**: SG; `grep -n "clone(true)" src/engine/blenderMonsters.ts` prints nothing.
- **Must not change**: the procedural placeholder builders; `lean-rig.test.ts`.

### X2 Final budgets [CLAUDE]
- **Tier**: sonnet.
- **Depends**: all promotes.
- **Files**: `tests/fixtures/model-contract/*.json`.
- **Change**: set every ceiling to design 9.1 and 9.2 as reset at S2: per-figure triangles, skinned meshes and wire bytes; per-file wire bytes; total at most 3,180,000 (2,600,000 if N-3).
- **Accept**: `ONE(tests/model-contract.test.ts)` passes; SG. If a ceiling does not hold, the figure is fixed, not the ceiling; a ceiling is raised only by an owner decision recorded in the design's review log.
- **Must not change**: contract entries (names, bones, clips); any GLB.

### X3 Final check [CLAUDE] + [HUMAN] + OM-F
- **Tier**: opus.
- **Depends**: X0, X2.
- **Files**: `docs/superpowers/baseline/models/final.md` (new), `README.md` (model and credits lines only).
- **Change**: SG; P5 repeated (a full rebuild compares clean against what is now shipped); the after sheets and captures indexed beside the before ones; per-file `curl -H 'Accept-Encoding: br'` sizes from the preview deployment [HUMAN]; Stage 5's start-pose draw calls and triangles and its leak check (GPU resources after 200 attacks and 20 gear swaps) re-captured and set against its budget; the hand-off list of design section 10 written out for Stage 6 and for the follow-up gear stage; the owner plays ten minutes on a real GPU and walks the camps.
- **Accept**: wire total within the X2 ceiling, measured on the preview; Stage 5's budgets still hold; **OM-F**.
- **Must not change**: `src/`, any GLB, any test.

---

## Order and parallelism

```
OM-0 -> R0 -> P1 -> (P2 | P3) -> P4 -> P5 -> V1 -> V2 -> V3, V4 -> (H6 -> H6b) -> F1 -> OM-1
merge-only:  OM-1 -> M0 -> M0p -> OM-S0b
pilot:       (P4 -> S0 -> S1b) | (F1 -> S1) ; M0p, S1 -> S2 ; S1b, S2 -> S3 -> OM-P -> S4 -> (Q1 if N-3)
hero:        OM-P -> H1 -> H2 ; H1, S1 -> H3a -> H3b ; H3a -> H4 ; H3a -> H5 -> H5b -> H7 -> OM-S2
gear, guards: G2 -> G2b -> G6 -> N1 -> N2 -> N3 -> OM-S3
monsters:    H7 -> M1 -> M1b ; S1b -> B1
             S4, B1 -> D2 -> D2b -> D3 -> M3d ; D3 -> D4 ; -> D5 -> OM-S4
             -> M3a -> M4a -> OM-S5 -> M3b -> M3e -> K1 -> K2 -> K3 -> K4 -> OM-S6 -> M3c -> M4c -> OM-S7
close:       all -> X0 -> X2 -> X3 -> OM-F
```

About 58 tasks: 12 in slice 0 (with H6, H6b, F1), 2 in slice 0b, 6 in the pilot (7 with Q1), 8 hero, 6 gear and guards, 9 in slice 4, 2 in slice 5, 6 in slice 6, 2 in slice 7, 3 closing, plus R0. The art tasks (H3a, H3b, H4, D2b, D3, M3a to M3e, K1, K2) are opus; S2 and D2 are fable with an opus verify; pipeline, engine wiring and merging are agy with a sonnet fallback; runs are haiku.

""")
p.between("## Risks to the plan", "## Review log", r"""## Risks to the plan

| Risk | Answer |
|---|---|
| The owner rejects the skinned approach at OM-P. | That is what the pilot is for. Slice 0 and the merge-only promotion stay; one figure and one engine branch are reverted; the design is redrawn. Nothing else has started. |
| The pilot's look is rejected but the approach is accepted. | Only S2 is redone; that is why one figure goes first. |
| The paint layer fails in the game at the pilot or at H7. | H6b's flag stays harmless; every `bake_paint` call is dropped; budgets get easier; nothing else moves. |
| The new dragon cannot be reached by script (D2). | The task stops after two attempts and goes to the owner with design 6.2's fallback. Slice 4 can promote Ashmantle and the demon later; the old dragon stays shipped until then, because the loader takes both kinds. |
| The hero's weights break when re-posed to arms down (H3a). | The recorded fallback: bind in the source pose and add the arm-down rotation to every clip; the mount test decides whether gear still fits. |
| `monsters.glb` is promoted seven times and the repository grows by about 30 MB of history. | Accepted; fewer promotions would mean larger, harder reviews. |
| An art task runs long because a look cannot be reached by script. | The task stops at its sheets and goes to the owner with the fallback of CALL-M8. |
| A slice's worktree promotes against a stale manifest. | Rule 0.4: promotions happen on the merged head, one at a time, by the main session. |
| Two load paths live side by side and the rigid one rots, or the skinned one is silently skipped. | `tests/skinned-figure.test.ts` exercises both from one file; `tests/model-contract.test.ts` knows which figures must be skinned at each promotion; X0 removes the rigid monster path. |
| The merge shifts the look of the engine's projected albedo tiles (critique M2). | Every merge promotion (M0p, G6) and every skinned figure is judged on an in-engine capture; the material-family tests do not judge the look. |
| Stage 4's model-key tests break. | Model keys never change; `kit` and `body` are separate look fields (B1, D5, K3), and B1's accept runs Stage 4's tests untouched. |
| Stage 4's reactions fight the mixer on clip-driven monsters. | R0 item 11 names where they are applied; M1 asserts they are present after the animator's update; the capture of M1b shows a flinch during a walk. |

---

""")
p.t = p.t.rstrip('\n') + r"""

### Revision of 2026-11-14: owner decisions

The owner answered the design's decisions (design 13.1); the plan was re-cut for them. The design's review log says what changed there.

| Area | Change to this plan | Why |
|---|---|---|
| Gate | OM-0 now asks only the four new decisions N-1 to N-4; the ten answered ones are recorded in the design | They are decided |
| Pilot | New slice 1: S0 (skinned-path tests), S1 (figure kit: rigs, bodies, weights, clips), S1b (the engine's skinned path), S2 (the goblin raider rebuilt and skinned, two body routes, two material variants), S3 (in the game), **OM-P**, S4 (promotion) | One figure goes through the whole chain before anything else commits; it replaces the old pattern task M2 |
| Figure kit | Old H2 split into F1 (merge, paint, export; slice 0) and S1; `joint_cap`, `cut_by_weights`, `decimate_to`, `pose_rest` and `pose_armature` dropped; `make_rig`, `organic_body`, `auto_weights`, `hard_weights`, `fold_weights`, `merge_by_family`, `make_clip` added | Skinned figures; no rigid joints to cap; no third-party body to cut |
| Hero | H3a is now the skin (author's weights folded onto the biped rig) with the ten clips keyed on bones; H2 moves gear mounting into one function before anything changes; H4a (the stepped against smooth spike) and OM-H4a dropped; H4 authors the twelve-clip biped library; H5 carries the **two** declared replacements; H5b puts the hero on the skinned path | Answers 1, 3, 4 and 8 |
| Tests | `tests/skinned-figure.test.ts`, `tests/gear-mount.test.ts`, `tests/monster-motion.test.ts`, `tests/monster-body.test.ts`, `tests/model-pack.test.ts` added; P1 and P4 gain skin cases; rule 0.3.3 names both replacements | Design 8.3 |
| Gear | G1, G3, G4, G5, G5b (bands, gear to budget, band shapes and lookup) moved to the follow-up stage; G2, G2b, G6 (merge only) stay | Decision N-2; the guards need the merge |
| Guards | N-alt (keep the knight) removed; N3 deletes `knight.blend` | Answers 5 and 9 |
| Monster motion | M1 and M1b become the motion table **and** the monster animator over shared clip libraries, with Stage 4's wind-up as the attack clip's anticipation | Answer 1: reuse |
| Dragons | D2a and D2b (cut the old dragon by its armature, reduce and dress it) replaced by D2 (a new dragon, fable) and D2b (the dragon library); D3 is Ashmantle's own body, not a kit; D1b becomes B1 with a second look field `body`; D5 sets `body` on the boss row | Answer 2 |
| Monsters | M2 replaced by the pilot; M3d rebuilds the demon instead of cutting it; M3a to M3e follow design 4.6 (rebuilt or kept, re-rigged); slice order: dragons and demon first among the monsters | Answers 2 and 7 |
| Closing | X0 removes the rigid monster path; X1 (shape studies) removed; X2's total is 3,180,000, or 2,600,000 with N-3 | Migration ends in one path; budget redone from measurement |
| Compression | Q1 (8-bit normals, weights and colour in the promote step) added, conditional on N-3 | Design 9.2 |
| Kept from the critique | P1 to P5, V1 to V4, H6, H6b, the manifest per file, CAPTURE at every art task, the merge-only pass M0 and M0p, model keys never changing | Still apply |
| Tiers | Fable stages are S2 and D2, each with its reason in 0.1; verifies stay opus | Owner model rules |
"""
p.t += "\n"
p.save(); print('p2 ok')
