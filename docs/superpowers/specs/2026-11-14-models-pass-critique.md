# Models pass: critique

Date: 2026-11-14. Branch `feat/models-pass` at `31bd74d`. Reviewed: `docs/superpowers/specs/2026-11-14-models-pass-design.md` (the design) and `docs/superpowers/plans/2026-11-14-models-pass-plan.md` (the plan). The reviewer did not write either. Every claim was treated as wrong until a file or an experiment confirmed it.

## Verdict: READY-WITH-FIXES

The direction is right and the safe pipeline is sound. Four premises were wrong in ways that would have wasted or broken work:

- The dragon and the demon do not move today.
- The motion review method shows the wrong clip.
- `playerMesh.ts` holds name and offset contracts the design never listed.
- The boss and variant wiring breaks Stage 4's tests.

All four are fixed in the documents. What remains open is owner decisions (section 5). Nothing here blocks OM-0, provided the owner reads the new decisions D-1 to D-4 first.

## 1. What was run

Everything ran in a scratch directory (paths below are relative to `<scratch>/crit`). One Blender process ran at a time, each under `timeout 600 systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 /usr/bin/blender --background --factory-startup --disable-autoexec --python-exit-code 1`. Nothing under `public/`, `blender/`, `src/` or `tests/` was written, and `git status` stayed clean.

| # | Experiment | Result |
|---|---|---|
| E1 | Audit of the five GLBs (JSON chunk and binary chunk; Brotli quality 3 through node `zlib`) | All file-level numbers of design 4.1 reproduced exactly (table 2). |
| E2 | `build_hero.py` copied into a fake root (`fakeroot/scripts/blender`, plus the Kai zip only), run on Blender 5.0.1 | Exit 0 in 15 s. `hero.glb` is 216,844 bytes. Its **binary chunk is byte-identical** to the shipped one, and the JSON is identical once the generator string is removed. The script also wrote `fakeroot/blender/hero.blend` (11.7 MB, different hash), `fakeroot/scratch/kai_baked_preview.png` and `fakeroot/blender/examples/kai/*`, which confirms the trap and the extra write targets. |
| E3 | Cycles CPU render of the shipped `hero.glb` `Slash`, six frames at 320 by 400 and 16 samples, done two ways | 0.07 to 0.38 s per frame on 24 threads. **The design's method (mute every NLA track but one) shows `Idle` in every frame**: right-arm Euler x stays at 0.10 to 0.11. With the active action cleared as well, the arm goes 0.10, -0.46, 0.98, 0.51, 0.24, 0.14: a wind-back, a strike and a settle. Saved at `renders/slash_compare.jpg` (top row: the design's method; bottom row: the fixed one). |
| E4 | Per-clip rotation range of every pivot, read from the GLB (largest angle between any two keys) | Table 3. `Slash`: right arm 1.84 rad, torso 0.90 rad, head 0.45 rad. |
| E5 | `COLOR_0` export: a byte colour attribute added to every hero mesh, exported with `export_vertex_color='ACTIVE'`, then parsed in node by three's `GLTFLoader` | `COLOR_0` is written as **normalised unsigned short VEC4 (componentType 5123), 8 bytes per vertex, even from a `BYTE_COLOR` attribute**. In node: 19 of 19 meshes have `color` and the material has `vertexColors: true`. With a constant colour the file grows from 216,844 to 247,584 raw bytes and from 137,913 to 142,915 on the wire. |
| E6 | Linked mesh data: the hero `Head` duplicated with shared mesh data, then exported | Both nodes reference mesh 2, which is written once. In three both meshes share one `BufferGeometry`. **The open question of plan D1 is answered: shared data exports once.** |
| E7 | Vertex AO bake on the unchanged goblin (59 meshes), Cycles CPU, 16 samples, `POINT` domain, run twice | Bake time 1.04 to 1.09 s. **The two exports are byte-identical** (binary chunk and JSON), so a baked build is deterministic enough to compare. Wire size 148,323 bytes. A render with and without the AO is at `renders/goblin_ao_compare.jpg`: the darkening at shoulders, hips and pouch is visible but subtle on today's boxy geometry. |
| E8 | Source `.blend` files listed with `bpy.data.libraries.load` (data only, nothing executed) | `Dragon-low-rig.blend` holds `Armature.001` and `RedDevil-Ex.blend` holds `Armature`. The knight holds two armatures. `build_monsters.py` 190-200 forces the rest pose and drops the rig. |
| E9 | Node trees of the dragon, the demon, the goblin, the chicken and the guard | Section 3, finding C1. |
| E10 | Monster material base colours, converted to sRGB luma | Goblin skin is 34% (dark variant 24%). Scorpion 16% and 10%, robe 9%, bark 12%, leather 13%, `cloth_dark` 14%. |
| E11 | Control exports of the goblin alone: no colour; no colour and no `TEXCOORD_0` | 15,976 vertices in all three exports (no colour, no UVs, POINT bake), so the POINT bake adds no vertex. Wire: 121,155 (matches the design's own number), 117,629 without UVs (-3%), 148,323 with the AO bake (+22%). Raw: 611,004, 474,416, 748,456. |
| E12 | Signed x rotation per key of `RightArmPivot` in the attack clips | `Slash` 0.11 to -0.62 then 0.95; `Chop` to -1.31 then 1.21; `Mine` to -1.34 then 1.19: each has a wind-back. `Lunge` rises 0.10 to 1.15 with none. `SpinSlash` holds the arm out while the torso spins. |
| E13 | Grep of every UV reader in `src/engine` | `albedoMaterial` passes `map` to `facetMaterial`, which tags the material `albedoSpace: 'prop'` (`materials.ts` 144). `sealAlbedoUvs` then overwrites every UV of such a mesh (`textures.ts` 383-391). Materials with no map sample no UV. Nothing reads a GLB's own UVs on a figure. |

The scratch directory is session-scoped: the montages E3 and E7 will not persist, and every number they support is written above.

Not run: any test suite, build, dev server or browser; the full five-script rebuild (E2 covers one script, design 3.2 covers all five); EEVEE.

## 2. Premise table

| Premise (design) | Verdict | Evidence |
|---|---|---|
| File totals: 11,909,588 raw bytes, 3,736,447 on the wire; triangles, meshes, materials and clips per file (4.1) | **Confirmed** | E1, number for number. |
| "No GLB has a texture, an image, a skin or a morph target"; every attribute is float `POSITION`, `NORMAL`, `TEXCOORD_0` | **Confirmed** | E1. |
| Dragon is 34,750 triangles: body 25,182, teeth 8,928, eyes 640 | **Confirmed** | E9: `elvarg_dragon_body` 25,182; `teeth_1` 4,320 and `teeth_2` 4,608; two eyes of 320. |
| Guard is 53,598 triangles, 27 meshes, 2 materials | **Confirmed** | E1, E9. |
| Gear is "506 meshes in 72 nodes" | **Not reproduced** | 506 meshes confirmed. I count 69 `Gear_*` group nodes. The difference does not change any decision. |
| "The engine ignores GLB textures and replaces every material" (K2) | **Wrong for the guard** | `createCastleGuard` keeps the GLB's own materials (`worldBuild.ts` 567-582). True for hero, gear and monsters (`blenderHero.ts` 182-275, `blenderGear.ts` 82-116, `blenderMonsters.ts` 93-137). |
| "The only colour read from a GLB is each material's base colour" | **Partly** | True for monsters and gear (`extractColorHex`, `extractEmissiveHex`). The hero reads **no** GLB colour: every hero colour is set in code (`blenderHero.ts` 182-197), and `playerMesh.ts` 126-158 recolours the shared materials when armour is worn. |
| Dragon motion: "code: head, wings, 4 legs" (4.2) | **Wrong** | E9: all seven dragon pivots are empty. The body is one mesh under the root. `poseMonsterLimbs` (`monsterMeshes.ts` 813-821) rotates the empty `HeadGroup`, `LWing` and `RWing`, so the only thing that moves is the whole-body bob of 0.32. |
| Demon: "code" motion, wings "attached off-centre" | **Wrong in part** | E9: `HeadGroup`, both leg pivots and `LeftArmPivot` are empty. The body (6,330 triangles, head and arms included) is one mesh under the root. Only the cleaver and the wings move. |
| "`Slash` moves 4 channels and reads as a shrug"; "Today `Slash` animates the arm and little else" (4.2, 5.7) | **Wrong; an artefact of the method** | E3, E4. Four channels are keyed, but the arm swings 1.84 rad, the torso turns 0.90 rad, and a wind-back comes before the strike. The strip in `docs/superpowers/baseline/models/hero-slash-strip.jpg` shows `Idle`. |
| Motion review: "muting all tracks but one plays that clip" (3.3) | **Wrong** | E3. The importer leaves `Idle` as each pivot's active action, and the active action overrides the NLA tracks. |
| Bodies of the goblin, ranger, guardian and scorpion "sit near 10%" (5.4) | **Partly** | E10. Scorpion, robe, bark and leather are 9 to 16%. Goblin skin is 24 to 34%. |
| Full build runs on 5.0.1 from a fake root and reproduces the structure (3.2) | **Confirmed for the hero, stronger than claimed** | E2: the binary chunk is identical, not only the structure. |
| Cycles CPU renders headless at 0.2 to 1.6 s a frame (3.1) | **Confirmed** | E3: 0.07 to 0.38 s at a smaller size. |
| A baked vertex colour exports and loads (3.3) | **Confirmed** | E5, E7. |
| `COLOR_0` costs 8 bytes per vertex | **Confirmed, and the plan contradicts it** | E5: 16-bit even from a byte attribute. Plan H2's "byte colour attribute" saves nothing. |
| Whether linked mesh data exports as shared accessors (15, risk table, plan D1) | **Answered: shared** | E6. |
| Draw calls: guards "fall" and figures cost fewer calls | **Wrong for the guards** | The knight is 27 meshes. Hero plus helm, plate body, plate legs, kite shield and sword is 18 + 20 + 13 + 3 + 3 + 3 + 2 = **62** per guard at today's counts, and about 32 after the gear merge. |
| Per-slice wire estimates (-20, -20, -30 kB for 4a, 4b, 4c) | **Not credible** | Finding H5. |
| Provenance and licence statements (4.2, 10.3, `CREDITS.md`) | **Confirmed** | Each row matches its licence file: dragon CC-BY 3.0 yoji (`BLENDSWAP_LICENSE.txt`), Kai CC-BY 3.0 (licence inside the zip, member `BLENDSWAP_LICENSE.txt`), knight CC0 Xali with the CGTrader note (`LICENSE.txt`), Red Devil CC0 1.0 with the author not recorded, Low-Poly Weapons CC0 1.0 (Drummyfish, after Cethiel). |
| "`--factory-startup`" mitigates T2 | **Not true of the runner** | `run-blender.mjs` 64-98 never passes it. Only the design's own probe commands did. |
| Every write target is listed (7.1) | **Incomplete** | `build_gear.py`, `build_monsters.py` and `build_world.py` accept `-- --render <path>` and render to any path (`build_gear.py` 3091-3098, 3109-3116). `export_from_blend.py` writes `public/models/hero.glb` whatever `.blend` it was given (lines 2 and 13). |
| Stage 4 contracts this stage touches (8.3) | **Incomplete** | Finding C4. |
| The pipeline is usable in CI | **Local only** | `.github/workflows/ci.yml` runs `npm test` and `npm run build` with no Blender. CI can check the shipped files against the manifest. It cannot build. |

### Measurements beside the author's

| Item | Author | Reviewer |
|---|---|---|
| hero / gear / monsters / guard / world, raw | 216,844 / 2,331,560 / 4,879,168 / 1,705,360 / 2,776,656 | same |
| same files, Brotli quality 3 | 137,913 / 668,121 / 1,266,221 / 1,174,350 / 489,842 | same |
| triangles | 5,304 / 73,504 / 98,644 / 53,598 / 41,776 | same |
| meshes | 18 / 506 / 399 / 27 / 433 | same (monsters: 399 meshes, 401 primitives) |
| vertices per triangle, procedural monsters | "about 1.8" | 1.79 to 1.86 per figure (goblin 1.83, scorpion 1.86); hero 0.64; gear 0.79 overall |
| dragon wire | 672,011 | 662,703. My method compresses the figure's buffers alone, without JSON, so this is not a disagreement. |
| goblin wire | 121,155 | 76,843 by the same buffers-only method. Not comparable. |
| hero rebuild on 5.0.1 | "structure identical" | binary chunk identical (E2) |
| `COLOR_0` cost | 8 bytes per vertex, +26% wire on the goblin | 8 bytes per vertex (E5). The goblin with an AO bake is 148,323 on the wire by my method (E7). |

## 3. Findings

### Critical

**C1. The dragon and the demon are statues; the plan dresses the dragon without making it move.**

Evidence:
- E9: `Monster_elvarg_dragon` holds `elvarg_dragon_body` (25,182 triangles), two eyes and two teeth meshes directly under the root. Its seven pivots have no children.
- `Monster_lesser_demon` has the same shape: the body under the root, empty `HeadGroup`, `LeftArmPivot` and leg pivots.
- `poseMonsterLimbs` (`monsterMeshes.ts` 813-821) rotates exactly those pivots. Stage 4 builds Ashmantle's flinch and wind-up pose on the same pivots (its 6.5).
- Plan D2 adds `Jaw` and a `TailPivot` chain to an uncut body, so they would move nothing.

For a player, the two bosses holding still while a goblin swings is the largest visible defect in the roster. The design never found it, because it judged the figures from still renders.

Fix (applied):
- The dragon and the demon are cut into rigid parts by their own armatures. Both sources have one (E8). Each face goes to the bone with the largest weight, each part is parented to the pivot at its bone head, joints are capped, and the rest pose comes out of the T-pose through the armature before the cut.
- The cut is now its own task (D2a, M3d), and the dragon work comes first in the monster order.
- The skinned alternative for these two figures is owner decision D-1.

**C2. The motion review shows `Idle` for every clip, and the motion diagnosis built on it is wrong.**

Evidence:
- E3 and E4.
- The plan's V1 copies the faulty method ("mute every NLA track but that clip's").
- H1 expects "red on today's file". In fact `every clip keys Torso or HeadGroup` is green today (all ten key `Torso`), and the `Slash` and `SpinSlash` torso cases are green (0.90 and 3.14 rad). Only `Lunge` (0.24) fails. The wind-back exists in `Slash`, `Chop` and `Mine` and is missing in `Lunge` (E12). The joint-overlap cases were not measured; H1 now records its own red list on first run.
- The clips that really are weak, measured: `Idle` (every pivot 0.02 to 0.06 rad), `Fish` (0.10 rad on the arms), the torso in `Walk` (0.04 rad, no counter-rotation), and `Lunge`.

Fixes (applied):
- V1 clears each pivot's active action before it unmutes a track, and V2 checks the `Slash` arm range against the GLB.
- H1 states which cases are green today, and its acceptance follows from that.
- H4 is rescoped to the measured weak clips, plus anticipation where an attack lacks it.
- H4 begins with a one-clip spike shown in the game (H4a).

**C3. `playerMesh.ts` holds name and offset contracts missing from design 8.1, and both the merge and the hero rework would break them.**

Evidence (`playerMesh.ts`):
- Lines 241-253 hide hero meshes named `Hair*`, `CrownSpike_*`, `BackSpike_*` and `Sideburn_*` under a helm.
- Lines 258-269 hide `TorsoCoat`, `OuterCoat_*`, `CoatTrim_*`, `CoatTail_*`, `CoatTailTrim_*` and `InnerCollar` under body armour.
- Lines 279-286 hide any gear leg mesh whose name contains `_04_` on the Blender hero. That is an ordinal name, and `merge_parts` renumbers ordinals. Today four meshes match: `Gear_dhide-chaps_legL/R_04_` and `Gear_trousers_legL/R_04_` (54 gear meshes carry `_04_` in all, so the merge exception is scoped to `_leg[LR]_04_`).
- Mount offsets are hard-coded against Kai's hands, feet and head: weapon and ring at (0.19, -0.32, 0.08) on `RightElbowPivot`; gloves at (±0.18, 0.32, 0.08); boots at (-0.11 or 0.085, 0.38, -0.01) on the knee pivots; helm at scale 0.74, offset -0.16; amulet at (0, -0.16, -0.04).

Change the hands, the head or the mesh names in H3, or merge gear in G2b, and armour floats, hair shows through helms, or coats show through plate. No test catches any of it.

Fix (applied): added to design 8.1 and to the manifest. `merge_parts` never merges across those names and keeps `_NN_` ordinals stable. H3 holds the hand, foot and head centres within 0.01 of today's. The manifest records the centres.

**C4. Wiring the boss and the two variants to new model keys breaks Stage 4's tests, and a kit-only `Monster_` node breaks the loader.**

Evidence:
- Stage 4 rewrites the frozen `blender-hero.test.ts` monsters case to assert "distinct model keys ... still exactly 10" and "every type's model key is one of the 10" (Stage 4 design 9.3 item 4).
- Its `tests/new-monsters.test.ts` asserts that the boss has "the dragon's model key" (its G4.9).
- Plan D4b and K3 set `model` to `ashmantle`, `saltback_stalker` and `thornwatch_marksman`, and declare no replacement.
- Plan D1's "kit pieces only in a node `Monster_<variant>`" route would also make `getObjectByName('Monster_<key>')` succeed on a node with no leg pivots.

Fix (applied):
- Model keys do not change. The kit is a separate look field, `kit?: string`, on the three rows. Its pieces live in nodes named `Kit_<name>`, whose children are named after the base model's pivots. `upgradeMonsterRigWithGltf` adds them under those pivots after the base clone.
- Stage 4's `tint` and `modelScale` keep the value and size.
- D1 is cut (answered by E6). D1b becomes the kit attachment, test first. D4b and K3 set `kit`, not `model`.
- No frozen or Stage 4 test changes.

### High

**H1. The compare contradicts the art tasks.**

Every art task must pass "BG with zero Contract differences", where the Contract includes pivot translations within 0.0001 against the shipped file. Yet those same tasks add pivots and nodes, move pivots within 0.05 (M2 to M3c), and remove meshes. As written, no art task can pass.

Fix (applied):
- **Contract** compares the built file with the **manifest**, which the same task updates.
- The built file against the shipped one is **Drift** only.
- An unchanged rebuild has zero Drift, as E2 shows is achievable.

**H2. Parallel slices collide on files.**

- Every slice edits the single `tests/fixtures/model-contract.json`.
- H6b edits `blenderHero.ts`, `blenderMonsters.ts` and `blenderGear.ts` inside the hero slice, while M1b edits `blenderMonsters.ts` and G6 edits `blenderGear.ts` in other worktrees.

Fixes (applied):
- The manifest is one file per GLB (`tests/fixtures/model-contract/<file>.json`).
- H6 and H6b move to slice 0. They are engine-only and inert without `COLOR_0`, which is the design's own claim.

**H3. The hero is never seen in the game before it is promoted.**

Renders of GLB colours cannot judge the hero: the engine discards every hero colour (premise table). Yet the first in-engine look at the hero is H7, after promotion. Plan H3 already sets up a throw-away worktree with the built file over the shipped one, for tests.

Fix (applied): every art task (H3a, H3b, H4a, H4b, M2, D2a, D2b) ends with an in-engine capture taken from that throw-away worktree. The owner sees before and after on the real GPU at the slice's OM step, before anything is promoted. `review_render.py` gains an engine-palette mode for the hero, which maps `extras.part` to the colours in `blenderHero.ts` 182-197, so the Blender sheets at least show the right colours.

**H4. Guards made from the hero raise draw calls.**

A guard goes from 27 meshes to 62 at today's gear counts, and to about 32 after the gear merge. Slice 3 is listed as "any time after slice 0".

Fix (applied):
- Slice 3 depends on G2b (the gear merge).
- Design 9.1 and fact 3 state the true count: guards cost slightly more calls than the knight. They are kept for bytes and look, not for calls.

**H5. The per-slice byte estimates are not credible, and the plan has no per-figure wire gate.**

Today's procedural figures compress about 7:1 (the goblin's buffers: 536,600 raw to 76,843). The organic ones compress 1.6:1 (hero) and 1.3:1 (dragon).

A reworked, merged, smooth 5,000-triangle figure at about 0.65 vertices per triangle is about 3,250 vertices:
- with position, normal, UV and colour, 40 bytes each: about 130 kB;
- plus 30 kB of indices;
- at hero-like compression, about 100 kB on the wire.

That is more than today's goblin, not 20 kB less. The file totals still hold, because the guard (-1,174 kB) and the dragon (about -340 kB at 14,000 triangles) carry them. The signs of slices 4a to 4c do not.

Fixes (applied):
- **Drop `TEXCOORD_0` from figure exports.** No figure reads GLB UVs (E13). That frees 8 bytes per vertex raw (parse time and memory), but on the wire it saved only 3% on the goblin, because box UVs compress well; the AO bake costs 22% there (E11). So this pays for the paint layer in memory, not in download. H2 verifies it with the real exports and the frozen hero test.
- A per-figure wire ceiling is recorded at M2 and gates every monster task.
- The per-slice estimates are relabelled "unknown sign until M2 measures".

**H6. "Old school 8k" depends on form, and primitives built by script have a ceiling the design does not test.**

The art direction (section 5) is good: the three reads, the value range, one exaggerated feature, the lean, negative space. But "carved" figures assembled from boxes, tubes and spheres by script tend to stay toy-like (look at `today-front.jpg`). Only the palette and the gap rules change that.

Scripted organic bodies are possible without an interface: a skin modifier over a stick graph, a voxel remesh, a smooth, and a decimation to budget. That is a common technique in procedural creature generators. The design never weighs it.

Fixes (applied):
- M2, the pattern figure for eight monsters, builds the goblin both ways (primitives with joint caps, and a skinned-graph remeshed body cut at the pivots) and shows both to the owner.
- M2 escalates to **fable**, with an opus verify, under the owner's model rules (the pattern every later figure follows).

**H7. "Twelve frames a second, held poses" is unclear and untried.**

glTF `LINEAR` keys at 12 per second do not hold. They interpolate, as today's 24 to 25 keys per second do (E4). Held poses need `STEP` interpolation, and stepped motion under a smooth camera at high refresh is a taste call that nobody has seen in this game. Meanwhile all ten clips would be authored before the owner sees one.

Fixes (applied):
- Owner decision D-4.
- H4 splits into H4a (a one-clip spike: `Slash` and `Idle`, exported both stepped and interpolated, shown in the game) and H4b (the rest, in the chosen style).
- The fallback is stated: today's attack clips stay, since they already have three beats.

**H8. The comparison with other games that the owner asked for is missing.**

The owner allowed other games' methods as inspiration and asked how each technique choice compares. The design names techniques but never sets them against common practice. One consequence matters for a decision: rigid segmented figures are not mainstream practice in 3D games since the late 1990s; skinned meshes are, low-poly games included. Rigid figures survive as a deliberate retro or toy look. CALL-M3 presents rigid as "the old-school look", which is true, but the owner should know it is a style choice made against the norm, kept because the engine, the gear and Stage 4 depend on it.

Fix (applied): design 6.0, a generic comparison table (silhouette, palette, paint layer, rig, modular gear, animation, level of detail, draw calls), with a verdict per row.

**H9. Paint order and the dragon's pose numbers under D-2.**

If D-2 moves the dragon first, D2b would bake paint and D5 promote it before OM-S1 has judged the paint layer on the hero, against design 14. And M1's test pins the dragon's attack numbers to today's, which were never seen on a mesh because its pivots were empty.

Fix (applied): D2b bakes only after OM-S1; under D-2 the dragon ships unpainted first. D2a and M3d may retune the dragon's and demon's rows, declared in the plan, replacing those rows of M1's test (a test this plan creates).

### Medium

**M1. The run-blender write targets are not closed.**

- `--render <path>` is accepted by three scripts.
- `export_from_blend.py` hardcodes `hero.glb`.
- The runner omits `--factory-startup` (premise table).

Fix (applied to P2): `paths.py` also checks the `--render` path. `export` writes `<out>/<target>.glb`. `--factory-startup` is added to every background spawn (not the GUI `open` spawn); the frozen test checks only relative flag order, so it stays green.

**M2. Merging changes how the engine's albedo tiles land.**

`assignProjectedUvs` stretches each geometry's UV span to at least `minSpan` 1 (`textures.ts` 287-303). A small part merged into a larger one gets a different texel density. The material-family test proves the triangles keep their material, not their look.

Fix (applied): the merge promotions (G2b inside G6, M0) are judged on an in-engine capture.

**M3. The vertex-colour flag on the hero would break armour recolouring.**

The hero shares one material per role and keeps it on the rig (`rig.tunicMat`, `legsMat`, `bootMat`, `gloveMat`). `playerMesh.ts` 126-158 recolours them when armour changes. H6b's "one with-colour and one without-colour instance" would leave the recolour on the wrong copy.

Fix (applied): `COLOR_0` is all or nothing per file (a manifest rule). With colour, the flag is set on the shared material itself, so there is no second instance.

**M4. `COLOR_0` domain.**

The `CORNER` domain can split vertices where corner colours differ (E5 went from 3,384 to 3,391 vertices, though a constant colour cannot split corners, so that is weak evidence). E11 is the real control: the `POINT` bake adds no vertex.

Fix (applied to H2): bake to the `POINT` domain.

**M5. The licence test does not cover Kai.**

"Every directory under `blender/examples/`" skips `Game Anime RPG Character.zip`, whose licence lives inside the zip.

Fix (applied to P4): every entry under `blender/examples/`, directory or zip, is named in `CREDITS.md`. A directory holds a licence file. A zip's central directory lists a member whose name contains `LICENSE` (names are stored uncompressed; the test needs only `Buffer.includes`).

**M6. Deleting `guard.glb` keeps the unclear knight mesh in the public repository.**

The question the design "removes" is still redistributed as `blender/examples/knight_28541/knight.blend`. `tests/credits.test.ts` pins only `LICENSE.txt` and the `CREDITS.md` line, not the `.blend`.

Fix: owner decision D-3.

**M7. The detail layer costs more than it saves.**

Stage 5 argues that triangles are cheap here and calls are what count (its 6.6, 6.7; no real-GPU frame time exists yet). Splitting every figure into base and detail meshes **adds** calls up close and removes the same number at distance. It also adds pop-in, a tag in every builder, one engine module, two tasks and a 65% rule that every art task must meet. The owner would not miss it.

Fix (applied): cut. `extras.detail`, `tag_detail`, L1 and L1b are removed, along with the tier row. The 85 px silhouette read stays as a rule for the whole figure.

**M8. Task sizes.**

- H3 (joints, cuts, hands, face, hair, merge, bake) is too big for one verify, and so are M3c (two monsters plus the demon's cut and re-pose) and D2 (cut, decimate, teeth, jaw, tail, materials).
- D4b and K3 are each a one-line data edit with its own verify.

Fixes (applied): split into H3a and H3b, M3c and M3d, D2a and D2b. D4b and K3 become one task (K3).

**M9. Tiers.**

G1 sorts items into three bands by level requirement, which is mechanical.

Fix (applied): G1 is sonnet, and opus verifies the table. M2 is fable (H6).

**M10. The draw-call win arrives late.**

The owner measured 51 FPS on an RTX 4070, likely CPU-bound on calls. The merge alone takes the goblin from 59 meshes to 29 with no redesign (design 3.3). Each monster mesh costs a colour call and a shadow call (Stage 5 6.2), and Stage 4 brings 42 monsters. Yet monster merging comes only with each art slice, months apart.

Fix (applied): new tasks M0 and M0p, a merge-only pass over every monster builder with no reshaping, promoted right after slice 0 and judged in the game. It is the first measurable frame-time gain, and it proves `merge_parts` on real data before any art task depends on it.

**M11. Value claims.** Goblin skin is 24 to 34% luma, not near 10% (E10). Fix (applied): the design's 5.4 now names the measured materials.

### Low

- **L1. `?v=` cache keys.** `vercel.json` marks only `/assets/*` immutable, so `/models/*` revalidates by default, and T7 is lower than stated. The hash-key test is cheap and stays.
- **L2. Gear node count.** I count 69 `Gear_*` group nodes, not 72. Fix (applied): reworded to "69 group nodes (47 silhouettes)".
- **L3. CI.** Fix (applied): the design now states that Blender work is local only, and that CI runs the manifest, licence and cache-key tests against the shipped files.
- **L4. Promotion history.** `monsters.glb` is now promoted six to seven times, about 25 MB of history. This stays accepted, as the plan says.

## 4. Simplicity: what was cut or can be

Cut (applied):
- the detail layer (M7);
- D1, which E6 answered;
- the `Monster_<variant>` kit nodes and model-key changes (C4);
- D4b, merged into K3.

Can be cut by the owner without a player noticing (decision D-6):
- X1, the shape studies of three monsters that have no rules yet. A silhouette made today is redrawn once Stage 6 gives them a size and a role.
- Band 2 ("forged") of the gear bands. The crest of band 3 is what changes the outline at 85 px. A middle band with one ridge mostly does not.

## 5. The big choices, argued

| Choice | For | Against | Critic's position |
|---|---|---|---|
| **Rigid jointed figures, or skinned** (whole roster) | Every engine path works today: cloning, outline shells sharing geometry, gear on pivots, Stage 4's poses. Cheap to author by script. A real retro style | Not mainstream since the late 1990s (6.0). Elbows and knees show caps or gaps; cloth cannot bend. A skinned path is a second loader, skinned outlines, bone-driven poses and gear on bones | **Rigid** for this stage, knowingly as a style choice. Revisit skinning as its own stage if the hero's joints still look stiff after H3a. |
| **Rigid or skinned for the dragon, Ashmantle and demon** (D-1) | Their sources carry armatures, so skinning is the cheapest place to start. Organic bodies bend better | The same second engine path, for three figures | **Rigid cut by weights.** |
| **Keep Kai or make a new original hero** (CALL-M4) | Keep: every mount offset, gear piece and test hangs on this body; it reads well. New: a body designed for the art direction, no CC-BY credit, an identity of the game's own | A new hero means re-fitting all 47 gear silhouettes and every mount offset (C3), and it is the riskiest scripted organic form | **Keep** now. If M2's remeshed route works, a new hero becomes a realistic later stage. |
| **Guards from the hero, or the knight reduced** (CALL-M2) | Hero: -1.17 MB, guards that breathe and match the game, the unclear upstream mesh leaves the build | Hero: guards look like the hero in armour; draw calls slightly up (H4). Knight reduced: keeps a distinct figure, -0.9 MB, still a T-pose to fix and an unclear source | **Hero-built**, after the gear merge. |
| **Dragon reduced to 14,000** (CALL-M7) | 26% of it is unseen teeth; about -340 kB | Reducing an organic third-party mesh can facet the silhouette | **Yes**, after the cut (D2a), checked on the turnaround. 14,000 is generous for a boss at 160 to 490 px. |
| **Vertex colour as the paint layer** (CALL-M11) | The only paint layer the engine allows (no textures in node tests, materials replaced); deterministic; seconds to bake | +22% on the wire for box figures; subtle on sparse meshes (E7); needs the engine flag | **Yes**, judged on the hero in the game first. Its value is larger in the engine than in Cycles, because the engine's figures have no other ambient term. |
| **Kits for the recoloured monsters** | Distinct outlines for no new body bytes; `kit` field leaves Stage 4 untouched | One more look field and a small engine attach | **Yes, as the `kit` field** (C4). |
| **Defer the three prepared-slot monsters** (CALL-M5, D-6) | No rules, size or place yet; a model nothing uses is dead download | Stage 6 starts without a silhouette study | **Defer entirely** (cut X1). |

### Stage 5's draw-call budget and the 51 FPS

Stage 5 caps the start pose at 1,000 colour-pass calls on Medium. At the start pose this stage is about neutral: the guards add about 10 calls a pass after the gear merge, and the hero, the merchants and visible chickens lose some to the merge. At the camps it is a clear gain: the merge alone takes a goblin from 59 meshes to 29, both passes, so a camp of seven saves about 200 calls a pass. Whether that moves 51 FPS depends on whether the owner's frame is CPU-bound on calls, which only a running scene shows; M0p captures the HUD's calls before and after so the owner can feel it in the game first.

## 6. Owner decisions, in one list (real trade-offs first)

| # | Decision | Recommendation |
|---|---|---|
| D-1 | **Dragon, Ashmantle and demon: cut into rigid parts or skin them.** Both sources carry armatures. | **Rigid cut by bone weights.** It keeps every engine path, Stage 4's poses and the outline shells. Skinning these three would look smoother at the joints but needs a second load path (`SkeletonUtils.clone`, skinned outlines, bone-driven poses), which is a stage of its own. |
| CALL-M3 | **Rigid jointed figures for everyone, or skinned.** | **Rigid**, knowing it is a deliberate retro style, not today's norm (6.0). |
| CALL-M2 | **Guards from the hero and gear, or the knight reduced.** | **From the hero**, after the gear merge: -1.17 MB and living guards, at the cost of the knight's distinct look and a few draw calls. |
| D-4 | **Motion style: stepped (held poses) or smooth.** | **Decide on the H4a spike in the game.** I lean smooth: stepped motion reads as deliberate in 2D, but in a 3D camera at 144 Hz it often reads as a low frame rate. |
| CALL-M4 | **Keep Kai or make a new hero.** | **Keep** for this stage. |
| CALL-M7 | **Dragon: cut, reduce to 14,000 and dress, or build a new one.** | **Cut, reduce, dress.** |
| CALL-M11 | **Vertex colour as the paint layer.** | **Yes**, judged on the hero in the game first. |
| D-2 | **Dragon and demon motion first among the monsters.** | **Yes.** Two bosses that stand still are the most visible fault. |
| D-5 | **An early merge-only promotion of monsters (M0).** | **Yes.** It is the first frame-time gain and changes no shape. |
| CALL-M6 | **`Death` and `Hurt` hero clips.** | **`Death` yes; `Hurt` only if Stage 4's lean looks stiff.** |
| D-3 | **Delete the knight's `.blend`** once the guards are rebuilt. | **Yes.** Keep its `LICENSE.txt` and credit line in the "not shipped" part. That takes the unclear upstream mesh out of the public repository too. |
| CALL-M5, D-6 | **Shape studies of the three future monsters; the middle gear band.** | **Cut the studies.** Keep the middle band only if the G4 silhouette sheet shows it reading at 85 px. |
| CALL-M8 | **New third-party models only as a fallback, CC0 or CC-BY.** | **Yes.** |
| CALL-M9, M9b, M10, M13, M1, M12 | Any Blender 5.x builds; compression stays shelved; `.blend` promoted with its GLB; review sheets committed; essence and art direction confirmed. | **Yes to all**, art direction after OM-1. |

## 7. Will a player see clearly better figures?

Yes, in four places:

- **The bosses and the demon moving at all.** Today they do not (C1).
- **Monsters lifted out of the 9 to 16% value range.** Silhouettes no longer share an outline, and joints no longer gap. `today-front.jpg` and `today-game-distance.jpg` show dark, gappy dolls, so this is the largest visible change.
- **Guards out of the T-pose and the sword-in-the-sky.**
- **Gear tiers you can read from the outline.**

Smaller in two places:

- **The hero.** Kai keeps his face, body and, as measured, already decent attack motion. Closed knees and elbows, a livelier `Idle` and a paint layer are real but modest.
- **The vertex paint layer.** It is subtle on today's geometry (E7). It matters more in the engine, whose figures have no other ambient term.

Whether the result reaches "old school 8k" rests on M2. If scripted primitives cannot carry form, the remeshed-body route of H6 or the CC0/CC-BY fallback of CALL-M8 has to. Making the figures cheaper (merging, decimation) is a real side effect, but it is not what the proposal mostly does. Done as amended, the stage is not timid. As first written, it would have spent its art budget dressing two statues and re-timing clips that were not broken.

---

## Second pass

Date: 2026-11-14. Branch `feat/models-pass` at `b4e0edc`. Scope: only what commit `d7b41aa` changed (`git diff 8170cc4 d7b41aa`), checked against the engine code at this branch (`src/engine/blenderHero.ts`, `blenderMonsters.ts`, `playerMesh.ts`, `materials.ts`, `dispose.ts`, `monsterMeshes.ts` 793-866, `textures.ts` 256-346), the frozen tests, three 0.169's own source in `node_modules/three`, the Stage 4 design on `origin/feat/combat-weight` (its 6.5) and the Stage 5 design's planned shader (its 6.1).

### Verdict: READY-WITH-FIXES

The central idea holds where the engine depends on it: names, axes, identity rest rotation, gear attached to bones, cloning, posing by `rotation.x`. It did **not** hold for the hero's joint positions, the file layout of skinned monsters, or the clip conversion, and the pilot had no stated gate. All are fixed in the documents; two items are now owner decisions (N-5, N-6).

### What was run

In a scratch directory; Blender 5.0.1 under `timeout 600 systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 ... --background --factory-startup --disable-autoexec`, one process at a time, 1 to 3 s each; node scripts importing three 0.169 by absolute path. Nothing in the worktree was written except these three documents. Results are design 3.5 S14 to S17.

| # | Experiment | Result |
|---|---|---|
| X1 | The hero source's bone heads put through `build_hero.py`'s own vertex transform (`S = 1.85 / 11.0498`, `Z0 = 4.2954`, 180 degrees about z), in glTF axes | Shoulders ±0.178 (centred) at 1.478; hips ±0.111 at 1.007; knees 0.604; `neck` 1.504, `head` 1.594; upper arm 28 degrees out. `LEAN_RIG`: shoulders ±0.28 at 1.50, hips 0.90, knees 0.52. Cross-check: the shipped `Boot_L` vertices span x -0.33 to -0.12 in figure space, consistent with the measured ankle at -0.248 |
| X2 | A prefixed rig as `Monster_probe` at (6, 0, 2), exported, loaded with a bare `GLTFLoader`, cloned with `SkeletonUtils.clone`, reset and moved into a group as `upgradeMonsterRigWithGltf` does | Every vertex 6.32 off; the inverse bind matrices hold the translation (-6, 0, -2). At the origin: 0 error; `rotation.x = 1` rotates an arm vertex exactly about the shoulder; a rigid child of the elbow bone lands exactly where the same offsets on a pivot chain land, with the torso turned |
| X3 | An empty keyed by today's `t2b_euler` and Blender `XYZ` against a bone keyed with the same numbers | Identical quaternion with the bone in Blender `XZY` (= three `YZX`); Blender `XYZ` is 0.34 rad off |
| X4 | Clones, shells, spheres, track names | Clones share the template's `boneInverses`; `shell.bind(skeleton)` without the bind matrix mid-pose is 14 off and moves another instance 13.5; with the bind matrix, exact. Tracks keep the prefix. `boundingSphere` is copied on clone |
| X5 | The 60-line 8-bit step of the revision (`quant.mjs`) on the probe file | Parses with the bare loader; normals `Int8Array` normalised, unit length through `getX`; positions `Float32Array`; no `uv` attribute, so `assignProjectedUvs` makes a `Float32` one. `COLOR_0` at 8 bits was not run |

### Findings

| # | Severity | Finding | Evidence | Fixed |
|---|---|---|---|---|
| F1 | Critical | **The hero's bones were to sit at `LEAN_RIG`'s pivots, 8 to 11 cm from the joints its author's weights bend about.** S13 only ever bound at the author's joints, so it did not support H3a. The A-pose fallback was called a 28-degree breach of the 20-degree rule, but today's ten clips were written for that pose (every clip turns the arms in by 0.28 rad): re-posing to arms-down would have made every converted clip push the arms into the body while passing H3a's orientation check | X1; `build_hero.py` 145, 149, 196, 200, 560-574 | Yes: bones at the author's joints, the biped reference pose is the hero's A-pose, no re-pose, mount offsets moved by the joint's move, a third declared replacement (lines 58-59, shoulder x); decision **N-5** |
| F2 | Critical | **A skinned figure laid out as `monsters.glb` lays out its figures is drawn 6.32 units off** once the engine resets the clone | X2 | Yes: design 6.1.1 rule 2b, `make_rig` at the origin, `cloneFigure` refuses, an S0 case |
| F3 | High | **The clip conversion was not implementable as written.** `make_clip` keyed Blender `XYZ` (0.34 rad off); `SpinSlash`'s converted arms would hold their direction while the shoulders orbit 4π, through the chest, and pass the 0.02 rad check; moving the torso's position keys to `Hips` sinks the feet 6 cm and slides them 16 cm in `Lunge` and lifts them 4 cm in `Cast`, unseen by an orientation-only check | X3; `build_hero.py` 76-119, 266-269, 302-306, 400-414 | Yes: quaternion keys from the `YZX` order; `SpinSlash` exception for the arm bones only (the head is converted normally, its yaw being 0.85 of the torso's); only the legs' keys go to `Hips`; a check that each leg root moves from rest exactly as the shipped leg pivot does; `Lunge` re-made in H4 |
| F4 | High | Clones share one `boneInverses` array; an outline shell bound without the bind matrix (and `addCartoonOutline` runs again on every gear change, mid-animation) corrupts every instance | X4; `playerMesh.ts` 397-400 | Yes: rule in 6.1.3, S1b, an S0 case |
| F5 | High | Clip tracks keep the builder's prefix, but only bones were to be stripped: Ashmantle (`ashmantle_` bones) could never play the dragon's `elvarg_dragon_` clips | X4 | Yes: `stripClipPrefix` per library |
| F6 | High | The pilot had no stated go/no-go, showed no shared clip on another stance (first seen at M1b, after the hero slice) and no face or hands at close range | plan S3, OM-P | Yes: criteria P-a to P-f, a mixer-only shared-clip capture in the throw-away worktree, three outcomes including "engine path yes, scripted bodies no" |
| F7 | Medium | Culling of a `SkinnedMesh` reads the object's sphere; today's shell code inflates the geometry's, which does nothing for a skinned shell | three `Frustum.js` 81-93, `SkinnedMesh.js` 38-99; `materials.ts` 98-104 | Yes |
| F8 | Medium | The chicken on the biped rig cannot play `Walk`, `Slash` or `Death` credibly (wings fold back along a horizontal body; a bird's visible leg joint bends the other way) and breaks the 20-degree rule by construction | `monsters.glb`: only two leg pivots under `Monster_chicken`; `monsterMeshes.ts` 836-841 | Yes: code-posed, exempt, kept by X0 |
| F9 | Medium | Goblin "target 3 (skin, leather and wood, metal)" merges two engine families; eyes are a separate unlit material | `blenderMonsters.ts` 106-125 | Yes: text says what the builder must author |
| F10 | Medium | The as-exported per-figure ceiling (115 kB) is below the probe body plus the measured paint cost (about 118 to 122 kB) before any hard part | design 3.3, 3.5 S9 | Stated; the 3.18 MB column is now called optimistic |
| F11 | Medium | Monster pivot positions "within 0.05" contradicted "rebuilt"; no engine code reads them | `grep` of `src/`: only `rotation` is written on monster pivots | Yes: names kept, positions free |
| F12 | Low | Shorter legs on the hero's `Walk` slide the feet | `blenderHero.ts` 121-122 | Yes: time scale by leg length |
| F13 | Low | `Hurt` was added though not asked | design 13.1 | Owner decision **N-6** |
| F14 | Low | H5b may edit a Stage 4 file that the monster cluster also edits (`loop.ts`) | plan 0.4 | Yes: R0 item 16 |

### Checked and holding

- **Names, axes and rest rotations.** `findPivot` and `getObjectByName` find bones. `poseMonsterLimbs` only writes `rotation` and the group's position (`monsterMeshes.ts` 793-866), and with identity rest rotation a bone's `rotation.x` means what a pivot's does (X2, exact).
- **Scale.** Monster groups keep the builder's scale, and the clone is reset to 1 (`blenderMonsters.ts` 82-84). `HeroRoot` has no transform today. Rule 2b keeps both true for skinned roots.
- **Gear offsets on bones.** Exact against a pivot chain (X2). They need only the joint-move arithmetic of F1.
- **Facing.** The hero's eyes and the goblin's eyes both lie at -z, so shared clips swing the same way on both.
- **Frozen tests.** `tests/run-blender.test.ts` survives the deletion of `knight.blend`: `export knight` resolves `blender/knight.blend`, which never existed, and no existence check runs. `tests/credits.test.ts` reads only the credit line and `LICENSE.txt`. `tests/textures.test.ts` and `tests/dispose.test.ts` build their own plain meshes. `tests/architecture.test.ts` imports every `src` module in node, and `SkeletonUtils` imports cleanly there. No other test parses a figure file. The count of declared replacements is now three, not two (F1).
- **three 0.169 claims.** `SkeletonUtils.clone` gives clones their own bones and rebinds with the source's bind matrix (`SkeletonUtils.js` 357-394). A bone texture is always used, so there is no uniform bone limit. The skeleton updates once per frame (`WebGLObjects.js` 52). The bone texture is created and bound in `WebGLRenderer.js` 2056-2058. The skinned variant is its own program (`WebGLPrograms.js` 311), and the depth material includes the skinning chunks (`depth.glsl.js` 7, 35), so shadows follow the pose. Clicks go to invisible hitboxes (`input.ts` 305 and 431 read `entityHit.object`, the hitbox).
- **Stage 5's planned shader** bands inside `RE_Direct_Lambert` on three's own normal, which is skinned. Its foot gradient reads object-space height, but it is off for figures. Today's `vCelNormal` patch (`materials.ts` 152-155) is the only bind-pose read, as the revision says.
- **Draw calls.** Recounted primitives from the GLBs: hero 18; goblin 59; camp 7 × 59 × 2 = 826; demon 22 meshes and 24 primitives (the design's 22 counts meshes; no disagreement). Hero 11 by engine role holds: eyes, hair, head, bracers, hands, sleeves, boots, legs, belt, inner chest and coat are 11 distinct material instances in `blenderHero.ts` 233-269. **Guard: the revision's "about 32, more than the knight" is wrong the other way.** `gear.glb` has no arm nodes for the plate body, and the guard's pieces are `Gear_helm` (5 families), plate-body torso, both plate legs, kite shield and sword (2 each). So 11 + 5 + 10 = about 26 per pass after the gear merge, against the knight's 27. That is acceptable as it stands. A per-guard merge at load would save about 13 per guard and is not worth a second path.
- **The 8-bit step and the engine's reads.** The engine reads `position` as metres and `normal` through `getX` (`textures.ts` 263-284), and writes its own `Float32` `uv`. Figures drop `TEXCOORD_0`, so nothing quantised is ever written back. Positions stay float. The claim holds for normals and weights (X5); colour was not run.
- **The author's skeleton.** `kaiV2.blend` has 59 deforming bones. All ten meshes carry an `Armature` modifier and 59 groups. Four coat vertices are unweighted, and the fold maps them to `Torso`.
- **Stage 4's reactions.** Flinch writes absolute `rotation` values and the group's position (`monsterMeshes.ts` 800-808), and the knock-back is a group offset, so both carry over to bones. On clip-driven figures they must run after `mixer.update`, as the revision says.
- **Plan shape.** Tests come before their implementations (P1, S0, H1, H6, M1, B1, D4, G2, N1, Q1). Every task carries a tag and a tier, with fable used only at S2 and D2. Allowlists collide only at F14. R0 re-checks the premises, and the follow-up stage holds the gear bands and the skinned gear.

### Where my measurements disagree with the revision

- Hero joints: the revision's "1.60, the source's own `neck` bone" is the `head` bone (1.594). `neck` is 1.504.
- The revision says "the hero's joints at `LEAN_RIG`" in H3a while S13 bound at the author's. Those are 8 to 11 cm apart (X1).
- "Exactly two assertions": three, if the joints move (F1).
- Goblin "at most 4, target 3" is not reachable with today's material set: that set gives 5 or 6 (F9).
- Guard: about 26 calls per pass, not about 32 (fixed in 6.4 and 9.1).
- 3.18 MB as exported is optimistic, and 3.4 to 3.5 MB is likelier (F10).

### Two questions the task asked

- **Are 16 bones enough for the hero with gear, a face and hands, at these distances?** Yes for the body. The hero is 85 to 410 px tall: the face is rigid with the head and the hands are mittens, which those sizes allow. Gear is rigid on bones, which is standard. The one likely gap is the shoulder with an arm raised to 1.45 to 1.55 rad (`Cast`, `Chop`, `Ranged`): there is no clavicle, so the deltoid may collapse. Optional `LeftShoulder` and `RightShoulder` bones are now allowed if H3a's worst-pose sheet shows it.
- **Is the 20-degree stance bound enough for the giant and the goblin?** It is a reasonable rule, but unvalidated. S4 varied proportions, not pose. The giant's arms swinging through its belly, or a hunched goblin over-reaching in `Slash`, is first seen at P-d (now in the pilot) and then at M1b. The per-model arm-swing scale and stance offset are the levers, and the chicken is exempt.

### The biggest risk, honestly

The risk is **the form of nine scripted bodies, not the engine.** The engine side is now specified and was measured end to end on a toy rig. A skin modifier over a stick graph, remeshed and decimated, gives smooth, continuous, well-weighted limbs. It gives no edge flow, so a face, an ear, a jaw, a hand, a cloak edge or a wing membrane comes out as a soft blob unless it is built as a hard part and stuck on. The revision's own probe lost its head. At 70 to 340 px that may be enough for "old school", and it may not be enough for "8k". Nobody has seen it yet. The hero is safe here: it keeps a person-made mesh and person-made weights, provided F1 is fixed.

The pilot must therefore show, in the game, at distance 5.4:
- a head with ears and jaw that reads as a goblin;
- hands that read as hands;
- a spear and shield that read as objects;
- the body bending through `Walk` and `Slash` from the hero's file without losing its hunch.

It must show both routes beside today's goblin, and the owner must be able to say "eight more like this". If the answer is "the engine yes, the bodies no", the plan now has a branch for it: rigged CC0 or CC-BY bases with their weights folded onto the shared rigs, or the rest left rigid and merged. Choose that branch at OM-P, not after the dragon.

### Open owner decisions, after this pass

Real trade-offs first:

1. **N-5, where the hero's joints go.** Recommended: at the author's joints, in the hero's own slightly arms-out pose. The skin then bends where it was made to bend and today's animations stay valid. The cost is one more frozen test line and recomputed gear offsets. The alternative keeps that test line, but the skin shears at the shoulders, hips and knees.
2. **N-3, 8-bit normals, weights and colour.** Recommended: yes. It saves about 30% on the two figure files with no decoder. Without it the stage probably ends near 3.4 to 3.5 MB, not 3.18 MB, and Stage 6 pushes past today's download.
3. **N-4, one draw call per monster or up to three.** Recommended: decide on the pilot. One call is cheapest, but cloth, hide and metal then all take the light the same way.
4. **N-1, the pilot figure.** Recommended: the goblin raider. It is cheap to redo and it tests everything except worn gear.
5. **N-2, split off the gear work.** Recommended: yes. Gear bands and bending cloth go to a follow-up stage.
6. **N-6, a `Hurt` animation.** Recommended: not in this stage. Stage 4's lean and flinch already show a hit.
