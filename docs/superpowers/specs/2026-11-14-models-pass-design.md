# Models pass: design

Date: 2026-11-14. Branch: `feat/models-pass`. All line numbers refer to commit `5caa597` (main, Stages 1 and 2 merged; Stages 3, 4 and 5 are approved designs that are **not** on this branch). Symbols are named next to line numbers because the lines will move before this stage starts.

Status: proposal. The owner has reviewed none of it. Every decision marked **CALL-M** is the lead's proposal and is collected in section 13. Nothing shipped was changed to write this: no file under `public/models/`, `blender/`, `src/`, `tests/`, `scripts/` or `package.json`.

Inputs read: `scripts/blender/*.py`, `scripts/run-blender.mjs`, `tests/run-blender.test.ts`, `CREDITS.md`, the five GLBs (JSON chunk and buffers, measured), `src/engine/gltf.ts`, `blenderHero.ts`, `blenderMonsters.ts`, `blenderGear.ts`, `monsterMeshes.ts`, `playerMesh.ts`, `playerGear.ts`, `materials.ts`, `textures.ts` (material part), `humanoid.ts`, `worldBuild.ts` (guard part), `context.ts` and `input.ts` (camera), `src/__tests__/blender-hero.test.ts`, `lean-rig.test.ts`, `tests/credits.test.ts`, the approved Stage 4 design ("Combat with weight") and Stage 5 design ("Visual pass"), the foundation design and plan, and the shelved compression design on `origin/feat/reach`.

What was run is in section 3, with commands. Everything ran in a scratch directory, with one exception: a twenty-line node probe had to sit beside the installed `three` package to import it, so it was written to the git-ignored `node_modules/` of this worktree, run once and deleted. The nine shipped binaries hash the same before and after (`sha256sum -c`, 9 of 9 OK) and `git status` is clean.

This stage lands **after Stage 5** and before Stage 6 (dungeons, more bosses).

---

## 1. Intent and why

The owner's words (translated): "it is an old-school game, but that does not mean it has to be shallow in visuals; it can be an old school 8k", and later: "we will need to work better on the models/Blender of the monsters, the character, etc." Other games' methods are fair inspiration; a specific game's character or look is not.

Reading: Stage 5 gives the world light, air and ground. The figures standing in that world are the next weakest thing. This stage makes the hero, the gear, the guards and the monsters better in **form, material and motion**, without changing a rule, a name or a save.

Five facts decide the design. All are measured (section 4) or seen in renders (section 3).

1. **Half of the model download is two third-party meshes.** The two castle guards (`guard.glb`) are a realistic knight of 53,598 triangles in a T-pose with no animation: 1,174,350 bytes on the wire, 31% of all model bytes, for two figures that stand still. The dragon is 34,750 triangles and 672,011 bytes on the wire, 53% of `monsters.glb`. Together they are 49% of the 3.74 MB.
2. **The eight procedural monsters read as dolls.** They are boxes and tubes with visible gaps at every joint, near-black body colours, and small parts (buttons, straps, studs) that vanish at play distance. The goblin raider and the goblin archer, and the dark ranger next to both, share one outline.
3. **Draw calls, not triangles, are what figures spend.** A monster is 22 to 68 separate meshes (the goblin 59, the scorpion 68); a gear piece averages 7 (506 meshes in 72 nodes). Every one is a draw call, a second one in the shadow pass, and a hidden outline shell (`materials.ts` 78-107).
4. **Gear tiers differ by colour only.** Every metal helm is `Gear_helm`, every plate body `Gear_plate-body`, every scimitar `Gear_scimitar` (`gearSilhouette`, `playerGear.ts` 73-135); the tier is `item.color` on one shape. A new set does not change the hero's outline.
5. **Nobody has ever rebuilt these files safely.** The build scripts write `public/models/*.glb` and `blender/*.blend` in place and there is no way to look at a model here except a render. So the first deliverable is a safe build and a way to look.

### Essence to preserve (CALL-M1)

Stage 5's rule stands: **cut world, round figures, real air.** Figures stay smooth-shaded with a two-band light so they read against the faceted world. Segmented figures on named pivots stay (section 6.1). No rule, formula, drop, name, save field or monster stat changes. Every node name, pivot, scale, material name and clip name the engine looks up is kept, or migrated with a test (section 8).

---

## 2. Constraints

| # | Constraint | Consequence |
|---|---|---|
| K1 | Stage 5 fixed the model download at 3.76 MB (its K2 and section 10) and keeps all five GLBs byte-identical. | This stage is the first allowed to change them. Its budget is a **lower** total (section 9). |
| K2 | The engine replaces every GLB material by name and re-projects UVs (`blenderMonsters.ts` 93-137, `blenderGear.ts` 82-116, `blenderHero.ts` 198-276, `assignProjectedUvs` in `textures.ts` 256). GLB textures are ignored; the only colour read from a GLB is each material's base colour (`extractColorHex`, `blenderMonsters.ts` 38-44). | Colour is authored as named materials plus vertex colour, never as an image (6.3). |
| K3 | Frozen tests parse the GLBs with a bare `GLTFLoader` in node (`blender-hero.test.ts` 26-34). | Measured: a GLB with `COLOR_0` parses; a GLB with an embedded PNG fails with "self is not defined". Embedded textures are out. |
| K4 | `template.clone(true)` and outline shells that share the mesh geometry (`blenderMonsters.ts` 81, `materials.ts` 92) assume rigid meshes. Gear mounts on pivot objects (`playerMesh.ts` 191-350). Monster motion is written against pivots (`poseMonsterLimbs`, `monsterMeshes.ts` 793-866), and Stage 4 builds its flinch, knock-back and wind-up pose on the same pivots (its 6.5). | No skinned mesh in this stage (CALL-M3). |
| K5 | Blender 5.0.1, headless only, on a shared 16 GB machine. Scripts were written for 5.2 on Windows. | One Blender process at a time, 3 GB cap, 10-minute timeout. The comparison is structural, not byte-for-byte (7.2). |
| K6 | Third-party assets need a licence that allows redistribution, kept beside the asset and recorded in `CREDITS.md` (`tests/credits.test.ts`). | Procedural first. New third-party sources only CC0 or CC-BY, one owner sign-off each (CALL-M8). |
| K7 | New content gets an original look. Borrow technique, never a character. | The three new silhouettes and every kit piece are designed here from role, not from a reference character. |
| K8 | Existing tests are frozen (foundation plan rule 0.3.3). | Replacements are declared in advance (8.3). |
| K9 | No new runtime dependency; `src/state` and `src/data` do not import `three`; no `src/` file over 1000 lines. | Tools are plain node scripts and Blender Python. New pure tables live in `src/data`. |
| K10 | Stage 4 separates a monster type from its mesh: `MonsterDef.model`, `tint`, `modelScale` (its 6.8). | A new mesh is one `Monster_<modelKey>` node and one data field. This stage depends on that mechanism and adds no rule. |

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
| Motion review | The importer turns each clip into NLA tracks per pivot; muting all tracks but one plays that clip. A six-frame strip of `Slash` rendered in under 3 s. It shows the swing barely moves the arm. |

### 3.4 Not run

No test suite, no build, no dev server, no browser, no in-engine capture, no real GPU. `run-blender.mjs export` (re-export of a `.blend` saved by 5.2) was not tried. Nothing was run through `run-blender.mjs` itself, because it has no output option.

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
| Hero (Kai) | Third party, CC-BY 3.0 (uchiha007), cut into 18 rigid parts by `build_hero.py` | 5,304 | 18 | 18 | 10 clips on 10 pivots; 3 to 16 channels each | 410 / 260 / 85 | Seams open at knee and elbow when a limb bends. The face is faint. `Slash` moves 4 channels and reads as a shrug. Nothing in the body leads or follows a swing. |
| Castle guard (2 placed) | Third party, CC0 (Xali); the author says the base mesh came from a marketplace model with unstated terms (`CREDITS.md`) | 53,598 each | 27 | 2 | none | 400 / 250 / 82 (body) | T-pose, sword pointing at the sky, one grey, realistic proportions in a stylised game. 107,196 triangles in the town for two statues. **The weakest asset per byte.** |
| Chicken | Procedural | 4,680 | 38 | 6 | code, 5 pivots | 178 / 113 / 37 | The best-reading figure today. Too many meshes for its size. |
| Goblin raider | Procedural | 8,292 | 59 | 10 | code | 343 / 218 / 71 | Box torso, tube limbs with gaps, near-black green. Shield and spear carry the outline alone. |
| Goblin archer | Procedural | 6,640 | 58 | 11 | code | 371 / 236 / 77 | Same outline as the raider; the hood hides the one feature (the ears) that says "goblin". |
| King scorpion | Procedural | 10,488 | 68 | 6 | code | about 540 / 345 / 113 | Good outline. Thin legs alias; 68 draw calls; one dark value. Stage 4's Saltback Stalker is this mesh, larger and darker. |
| Dark wizard | Procedural | 3,980 | 24 | 9 | code | 560 / 355 / 116 | The hat reads; the robe is a cone with stripes; the staff merges with the body. |
| Dark ranger | Procedural | 5,340 | 37 | 8 | code | 500 / 317 / 104 | Reads as "dark figure with stick". Stage 4's Thornwatch Marksman is this mesh, tinted green. |
| Hill giant | Procedural | 7,288 | 45 | 9 | code | 785 / 498 / 163 | Good mass. Joints are stacked balls; the club is lost in front of the belly. |
| Moss guardian | Procedural | 6,968 | 43 | 6 | code | 919 / 583 / 191 | Dark brown on dark green; the glowing core is the only thing that reads. |
| Lesser demon | Third party body, CC0 ("Red Devil"), plus procedural wings and cleaver | 10,218 | 22 | 7 | code | 907 / 576 / 188 | T-pose arms; wings attached off-centre; realistic thin limbs beside doll-like neighbours. |
| Dragon (Elvarg) | Third party, CC-BY 3.0 (yoji) | 34,750 | 5 | 3 | code: head, wings, 4 legs | 772 / 490 / 160 (to the wing tips) | One flat dark green. 8,928 of its triangles (26%) are teeth nobody sees. Stage 4's Ashmantle is this mesh in ash grey at 1.2 times the size. |

Monster wire bytes: the dragon alone is 672,011 (measured); the goblin raider 121,155 (measured); the other eight share about 470,000.

### 4.3 Gear

72 nodes, 47 silhouettes, 73,504 triangles, 506 meshes, 8 semantic materials (`gear_primary`, `gear_trim`, `gear_glow`, `gear_wood`, `gear_leather`, `gear_dark`, `gear_white`, `gear_crimson`). Procedural, except four pieces that start from the CC0 "Low-Poly Weapons" pack (`build_gear.py` 846, 910, 971, 1667). Heaviest: mace 2,908 triangles, staff 2,856, the helms 1,300 to 2,800. A staff is 11 meshes.

Weak points: tiers share one shape (fact 4); the three third-party blades have ragged edges that shimmer; a full ten-slot loadout is more than 60 draw calls before outlines and shadows; a helm of 2,768 triangles sits on a head 40 pixels wide.

### 4.4 World props

`world.glb` (29 props, 41,776 triangles) is **out of scope**. Stage 5 keeps it byte-identical and merges it at run time (its 6.6). The safe pipeline of section 7 covers it so that a later stage can rebuild it.

### 4.5 An engine cost found while reading

Every monster instance clones every geometry (`blenderMonsters.ts` 96), and every gear clone does the same (`blenderGear.ts` 85). Thirty-six monsters hold thirty-six copies. Fewer, smaller meshes shrink this; removing the clone is not this stage's work.

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

- Humans are 5 to 5.5 heads tall. Hands and feet are 15% larger than life, weapons 20% larger. The hero keeps the `LEAN_RIG` pivots exactly (8.1).
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
- **Value range 25% to 75%.** Nothing darker than 18% sRGB except eyes and deliberate voids: today's goblin, ranger, guardian and scorpion bodies sit near 10% and turn to mud in shadow, where Stage 5's sky-coloured shadow needs something to tint.
- **Hue belongs to the species, value to the role.** Goblins are olive, the dunes creatures ochre and bone, the woods creatures bark and moss, the volcanic ones slate and ember. Inside a species, the caster is lightest, the brute darkest.
- **Four surface families**, each a named material so the engine can treat it (K2): skin or hide (albedo tile, soft), cloth (double-sided, matte), hard (metal, horn, chitin, bone: plain colour, crisp band), glow (small, saturated, the only thing that blooms: Stage 5's 5.2).
- **Painted depth without textures**: every figure carries a vertex-colour layer baked by the builder: ambient occlusion in creases, a top-to-foot gradient of about 15%, and a slight warm-to-cool shift from front to back. It multiplies the material colour. It is what makes a 5,000-triangle figure look carved instead of plastic (6.3).

### 5.5 How gear tiers read at a glance

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

It is built as a **kit**: the base body (the same mesh data, so no new bytes) plus two or three kit pieces of its own. Saltback Stalker: salt-crusted back plates, a forked double sting, heavier claws. Thornwatch Marksman: a thorn-wreathed hood, a tall bramble quiver, a longer bow. Ashmantle: a slag crown, back plates with glowing seams, a clubbed tail.

### 5.7 Motion

- **Twelve frames a second, held poses.** Clips are keyed on few strong poses with fast moves between them. This is the old-school reading of weight, and it suits rigid parts.
- **Every attack has three beats**: anticipation (the body goes the other way first), the strike (two frames), the follow-through with a settle.
- **The torso and head lead.** A swing starts in the hips and chest and the arm arrives last. Today `Slash` animates the arm and little else.
- **Idle is alive**: weight shift, breath, a look around, and one small trait per species (the goblin scratches, the giant rolls a shoulder).
- Stage 4's reactions (hit stop, flash, flinch, knock-back, wind-up pose) are drawn by the engine from events. They need from the models: a torso that can lean 15 degrees without opening a gap, a head pivot, and for every monster the arms-or-head-or-wings pivots its wind-up pose raises. Section 8.2 lists them.

---

## 6. Technique

### 6.1 Segmented figures on named pivots, not skinned meshes (CALL-M3)

| | A. Segmented, improved (recommended) | B. Skinned meshes and bones |
|---|---|---|
| What | Rigid parts parented to named empties, as today. Each joint gets an overlapping ball or collar so no gap opens. More pivots where motion sells. | One mesh per figure deformed by an armature. |
| Engine | No change to loading, cloning, outlines, gear mounting, monster posing, Stage 4's reactions. | `SkeletonUtils.clone`, skinned outline shells, gear re-mounted on bones, `poseMonsterLimbs` and Stage 4's poses rewritten for bones, material rules by mesh name lost. |
| Look | The carved, jointed figure of 1990s 3D, done well. Fits "old school". | Bending elbows and cloth. |
| Risk | Low. | High: touches every contract in section 8. |

B is a later stage of its own if the owner wants bending limbs. Nothing here blocks it.

### 6.2 Where meshes come from (CALL-M8)

1. **Procedural Python builders are the default**: reviewable as a diff, repeatable, original, no licence. The eight procedural monsters, all gear and all kit pieces stay procedural.
2. **Third-party bodies that already ship stay** where an organic form is beyond primitives (the hero, the dragon, the demon), cleaned by script: decimated to budget, posed out of the T-pose, cut at the pivots.
3. **A new third-party source** is allowed only when a procedural attempt has failed the owner's look, and only if its licence is CC0 or CC-BY (any version) with the licence file committed beside it and a `CREDITS.md` row. Never non-commercial, no-derivatives, "editorial", "free for personal use" or unstated. One owner sign-off per asset.
4. Sculpting by hand is not available here (no interface). Everything must be producible by `blender --background`.

New builder code goes in one new module, `scripts/blender/figkit.py`, imported by the build scripts: joint caps, merge by pivot and material, the vertex-colour bake, detail tagging, decimation to a budget, pose a third-party rest pose. The helper functions duplicated across the three large scripts are left as they are; moving 9,500 lines is not this stage.

### 6.3 Colour: named materials plus vertex colour, no textures

- Materials keep their names; the engine keeps choosing the surface by name (K2).
- The builder bakes the layer of 5.4 into `COLOR_0` with Cycles on the CPU (measured, 3.3: it works headless and takes seconds). The cost is real: 8 bytes per vertex, +26% on the wire for a figure whose geometry does not change. The budgets of 9.2 hold only because the reworked figures have far fewer vertices: today's procedural meshes carry about 1.8 vertices per triangle (split normals on every box edge), and a merged, smooth-shaded figure at budget carries under 1. Each promotion measures it; if a file misses its budget, the paint layer's strength is not the lever, the vertex count is.
- **One small engine change**, after Stage 5's light model: the three upgrade functions pass `vertexColors: true` to `facetMaterial` and `albedoMaterial` when the cloned geometry has a `color` attribute. A figure without the attribute renders exactly as today, so files can be promoted one at a time.
- No image is embedded (K3) and none is added to `public/`.

### 6.4 Draw calls: merge at build time

After a figure is built, `figkit.merge_parts` joins meshes that share **pivot, material, outline flag and name class** (the engine keys rules on "eye", "glow", "gem", "orb", "string" in mesh names, `blenderMonsters.ts` 106-110, `blenderGear.ts` 93-109; a joined mesh keeps a name in the same class). Measured on the goblin without any redesign: 59 to 29. With the palette rule of 5.4 the target is at most 14 for an ordinary monster. A test proves the engine classifies the same triangles into the same material families before and after (8.3, new test).

### 6.5 Animation authored as code

The hero's ten clips are already written as Python functions of time that key the pivots (`build_action` and `build_all_animations`, `build_hero.py` 76-416). That stays: a clip is a short pose table (pose name, frame, easing) and the builder samples it. Review is by frame strip (7.3).

- **Hero**: the ten clips are re-authored to the rules of 5.7. Two constraints come from the frozen test (`blender-hero.test.ts` 63-70): 0.2 s into `Walk` a leg pivot has turned more than 0.01 rad, and 0.15 s into `Slash` at 1.2 speed the right arm has turned more than 0.05 rad on x. So "the arm arrives last" means the arm starts its wind-back at once, in the anticipation, and the torso leads the strike; both samples go into the manifest.
- Two clips are added if the owner agrees (CALL-M6). `Death`: today the hero stays standing behind the death overlay (`handlePlayerDeath`, `actions.ts` 361-375); the clip makes it fall. `Hurt`: Stage 4 already leans the torso, offsets the mesh and freezes pose time on a heavy hit (its 6.5), all as engine offsets that never interrupt a swing. `Hurt` does not replace any of that. It plays under those offsets only when no attack or skill clip is running, and adds what an offset cannot: the arms and head recoiling and the knees giving.
- **Monsters stay posed in code**, because Stage 4 builds on `poseMonsterLimbs`. What changes: the `if (typeKey === ...)` chain (`monsterMeshes.ts` 813-843) becomes a small data table per model key, and the models gain **optional** pivots the table can move: `Jaw`, `TailPivot`, `WeaponPivot`, `LeftElbowPivot`, `RightElbowPivot`. A missing optional pivot is skipped, as `findPivot` already allows.
- Authored clips per monster (a mixer per monster) are not in this stage. Stage 6's bosses may want them; the builder that writes hero clips works for any pivot set.

### 6.6 Level of detail: a detail layer, not a second mesh

A second, simpler mesh per figure would add about a third to the bytes. Instead the builder tags each small part (straps, studs, teeth, claws, trim) with `extras.detail = true` and merges those into separate "detail" meshes. The engine hides a figure's detail meshes when the figure is under about 110 px tall or the tier is Low. Cost: no bytes; a figure loses 25 to 40% of its triangles and about half its draw calls at distance. Rule for builders: **the base layer alone must pass the 85 px silhouette read**, and holds at most 65% of the triangles.

---

## 7. The safe pipeline and the review loop

These are the first tasks of the plan. No model changes before both exist.

### 7.1 Build never writes into the shipped folders

- One new module, `scripts/blender/paths.py`, gives every script its output paths. The output directory comes from `-- --out <dir>` and defaults to `scratch/models-build/` (`scratch/` is already git-ignored). It **refuses** a directory inside `public/` or `blender/`. The Kai zip is extracted under the output directory, each member's path checked to stay inside it. The hero script stops rendering a preview during a build.
- `run-blender.mjs` accepts `--out <dir>` and passes it through after `--`. `all` still spawns exactly four builds and the flag order is unchanged, so `tests/run-blender.test.ts` stays green untouched. The guard script gets a mode name. `export` (re-export of an edited `.blend`) also writes to the output directory.
- `--disable-autoexec` and `--python-exit-code 1` stay on every call (third-party `.blend` files are untrusted input).

### 7.2 Compare, then promote on purpose

`scripts/models-compare.mjs <built.glb> <shipped.glb>` is plain node (it reads the GLB JSON chunk and buffers; no dependency). It prints and writes a report in three parts:

| Part | Checks | A difference means |
|---|---|---|
| **Contract** | Node names and parents; pivot translations within 0.0001; scales; material names; mesh name classes; `extras`; clip names; that each clip still moves the pivots the tests read. | **Stop.** A contract changes only together with its manifest and its test in the same commit. |
| **Budget** | Triangles, meshes and materials per figure; raw bytes; Brotli quality 3 bytes; per file and total, against section 9. | **Stop** if over. |
| **Drift** | Bounds per figure, geometry hashes, the generator string. | Information for the reviewer. |

The contract is a committed manifest, `tests/fixtures/model-contract.json`, generated once from today's shipped files and edited only by tasks that declare the change. `tests/model-contract.test.ts` checks the shipped GLBs against it on every test run, with no Blender.

`scripts/models-promote.mjs <name> --yes` copies **one named file** from the build directory to `public/models/` (and its `.blend`, CALL-M10) only if the compare passes Contract and Budget, and prints the new hash. The loader's `?v=` key for that file is then set to the first eight hex digits of the file's SHA-256, and a test keeps the two equal, so a changed model can never be served from an old cache entry. A rebuild that changes nothing is never promoted.

Which Blender builds the shipped file is not fixed: the comparison is structural and the manifest is the truth (CALL-M9).

### 7.3 Looking: the review loop

`scripts/blender/review_render.py` imports a GLB (built or shipped) and renders, with Cycles on the CPU, for every figure:

| Sheet | Content | Proves |
|---|---|---|
| Turnaround | Front three-quarter, side, back three-quarter, 512 px | Form, proportion, joints |
| Silhouette | The same three views in flat black on white | The 85 px read; species told apart on one roster sheet |
| Play distance | Crops of a 1080-line frame at distances 5.4, 8.5 and 26, at in-game scale, with the pixel height printed | What survives at play size |
| Motion | Six frames per clip in a strip (hero), or the pose table's poses (monsters) | Anticipation, strike, follow-through; joint gaps in the worst pose |
| Before and after | The shipped and the built figure side by side, same camera | The change |

Sheets are JPEG, committed under `docs/superpowers/baseline/models/<slice>/`, at most 2 MB per slice.

**In-engine capture.** The same fixed-pose method as the Stage 2 captures (`docs/superpowers/baseline/g4/`), using the debug pose hooks Stage 5 adds (`photo.ts`, its 8.2), with four model poses: hero close, hero at reset distance, the two guards, and one camp per slice. Taken before and after each slice.

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
| gear | Nodes `Gear_<silhouette>` with suffixes `_torso`, `_armL`, `_armR`, `_legL`, `_legR`, `_L`, `_R`; geometry in mount space | `playerGear.ts` 204, 309-311, 373-375; `build_gear.py` 16-24 |
| | Material names `gear_*` and mesh name classes | `blenderGear.ts` 93-116 |
| monsters | Node `Monster_<typeKey>` (after Stage 4: `Monster_<model key>`) | `blenderMonsters.ts` 78 |
| | Pivots `<key>_HeadGroup`, `_LeftArmPivot`, `_RightArmPivot`, `_LeftLegPivot`, `_RightLegPivot`, `_LWing`, `_RWing`; both leg pivots exist for every type | `blenderMonsters.ts` 57-71, 151-157; test 155-156 |
| | Material name substrings (skin, scale, chitin, feather, cloth, robe, leather, fur, wing, hoof, wood, bark, moss, stone, iron, bronze, steel, glow) and "eye" in mesh names; base colour | `blenderMonsters.ts` 38-55, 103-136 |
| | Size: the clone is reset to scale 1 and the group keeps the builder's scale | `blenderMonsters.ts` 82-84 |
| guard | `/models/guard.glb`, loaded in `createCastleGuard` | `worldBuild.ts` 534-567 |
| all | Parse in node with a bare `GLTFLoader` | test 26-34 |

All of these are kept. They become the manifest of 7.2.

### 8.2 What is added (never renamed)

| Addition | For | Engine side |
|---|---|---|
| `COLOR_0` on figure meshes | 6.3 | One flag in three upgrade functions |
| `extras.detail` | 6.6 | A distance and tier switch |
| Optional monster pivots `Jaw`, `TailPivot`, `WeaponPivot`, `LeftElbowPivot`, `RightElbowPivot` | 6.5, Stage 4's wind-up pose | The pose table |
| Nodes with `_b2` or `_b3` appended after any part suffix (`Gear_helm_b2`, `Gear_plate-body_torso_b3`) for the shared silhouettes | 5.5 | The node-name lookup tries the band name first and falls back to the base node |
| Nodes `Monster_saltback_stalker`, `Monster_thornwatch_marksman`, `Monster_ashmantle` | 5.6 | Stage 4's `model` field on three data rows; no other code |
| Hero clips `Hurt`, `Death` (CALL-M6) | Stage 4 | `HeroClipName` and two call sites |

### 8.3 Tests

Kept green untouched: `tests/run-blender.test.ts`, `tests/credits.test.ts` (the knight's credit line and licence file stay, 10.3), `src/__tests__/lean-rig.test.ts` (it tests the procedural fallback rig), and `blender-hero.test.ts` except the one assertion below.

Declared replacement, only if CALL-M6 is accepted: `blender-hero.test.ts` 39-42 asserts the hero has **exactly** ten clip names. The replacement asserts the ten are present and that the full list equals the manifest's.

Also to check at the premise re-check (plan R0): `blender-hero.test.ts` 136 asserts ten monster types, which Stage 4's three new rows will already have had to address.

New tests: the model contract and budgets; the cache key; no absolute path or user name inside any GLB's JSON; material-family equality across a merge; band table covers every equippable item; pose table has a row for every model key; a detail-hidden figure keeps every contract pivot.

---

## 9. Budgets

### 9.1 Per figure

| Class | Triangles (all tiers load the same file) | Of which base layer | Meshes after merge | Materials |
|---|---|---|---|---|
| Swarm creature | 1,200 | 800 | 6 | 3 |
| Small (chicken) | 2,500 | 1,600 | 8 | 4 |
| Ordinary monster, guard body | 5,000 | 3,200 | 14 | 5 |
| Large (giant, guardian, demon, captain) | 7,000 | 4,500 | 16 | 5 |
| Boss (dragon, Ashmantle, dungeon boss) | 14,000 | 9,000 | 20 | 5 |
| Hero body | 6,000 | 4,000 | 20 | as today |
| One gear piece | 1,200 (two-handed weapons and crested helms 1,600) | 800 | 4 | 4 |
| Hero with a full loadout | 16,000 | | 55 | |

By tier: Low draws the base layer only, always. Medium, High and Ultra draw the detail layer when the figure is taller than about 110 px. Nothing else varies by tier, so Stage 5's tier table gains one row: "Figure detail layer: off / near / near / near".

Stage 5's start-pose triangle budget (550k on Medium) gets easier: the two guards fall from 107,196 triangles to about 20,000.

### 9.2 Bytes on the wire (Brotli quality 3)

| File | Today | Budget after this stage | Why |
|---|---|---|---|
| `hero.glb` | 137,913 | 200,000 | joint caps, vertex colour, two clips |
| `gear.glb` | 668,121 | 900,000 | 12 band nodes, vertex colour (+26% if nothing else changed); smaller helms and staves pay part |
| `monsters.glb` | 1,266,221 | 1,250,000 | dragon to 14,000 triangles (measured: 12,000 in the body saves 217 kB), demon to budget, three kits, vertex colour |
| `guard.glb` | 1,174,350 | **0** (deleted, CALL-M2) | guards are built from the hero and gear |
| `world.glb` | 489,842 | 489,842 | untouched |
| **Total** | **3,736,447** | **at most 2,850,000** | **about 0.9 MB less than today**, with every figure reworked and three kits added |

Reserve handed to Stage 6: captain 80 kB, swarm creature 25 kB, dungeon boss 250 kB. With them the total stays under 3.25 MB, below today's 3.76 MB.

Per-slice numbers are estimates until measured by the compare step; the two anchors (guard, dragon) are measured.

**Compression (CALL-M9b).** The shelved design saves about 1.2 MB for a build step, a decoder in the JS bundle and two new dev dependencies. This stage removes about as much by deleting waste, with no decoder. Recommendation: **keep it shelved.** Revisit only if the model total passes 3.76 MB again. Note for that day: quantised normals would interact with nothing here, and its "TEXCOORD stays float" rule still holds.

### 9.3 Load time and memory

Parse time follows raw bytes: 11.9 MB today, about 9.5 MB after. GPU and heap memory per instance fall with the mesh count (4.5). No new request is added: `guard.glb` is one fewer.

---

## 10. Scope: slices in order

Each slice is showable alone and ends with before and after sheets, an in-engine capture, and the owner's look.

| # | Slice | Why here | Wire bytes | Triangles | Effort |
|---|---|---|---|---|---|
| 0 | **Safe pipeline and review loop**; baseline sheets of everything | Nothing can change safely or be judged without it | 0 | 0 | 9 tasks, small |
| 1 | **Hero**: closed joints, face and hands that read, vertex colour, ten clips re-authored, `Hurt` and `Death` | On screen every second of play | +60 kB | 5,304 to at most 6,000 | 9 tasks, large (art) |
| 2 | **Gear**: three bands for the shared silhouettes, merged meshes, budgets | Worn by the hero always; the reward the player sees | up to +230 kB | 73,504 to about 80,000 in the file; a worn loadout falls | 8 tasks, large |
| 3 | **Guards from the hero body and gear**; `guard.glb` deleted | Pays for everything else; fixes the weakest asset. Needs no Blender. Can run any time after slice 0; best after 2 | **-1,174 kB** | -87,000 in the town | 3 tasks, small |
| 4a | **Start-region monsters**: chicken, goblin raider, goblin archer | The first things a new player fights | about -20 kB | 19,612 to at most 12,500 | 5 tasks, medium |
| 4b | Scorpion, dark wizard, dark ranger | Mid game | about -20 kB | 19,808 to at most 15,000 | 2 tasks, medium |
| 4c | Hill giant, moss guardian, lesser demon (posed out of the T-pose) | Late game | about -30 kB | 24,474 to at most 21,000 | 2 tasks, medium |
| 5 | **Dragon to budget; Ashmantle as a kit on the same body** | Two bosses; today one mesh in two colours | about -150 kB | 34,750 to at most 14,000, plus a 3,000 kit | 6 tasks, medium |
| 6 | **Kits for Saltback Stalker and Thornwatch Marksman** | Today recolours | +50 kB | +2,500 | 4 tasks, small |
| 7 | **Detail layer switch**, final budgets, hand-off | Needs every figure tagged | 0 | 25 to 40% fewer drawn at distance | 5 tasks, small |

Net: about -1.05 MB by these estimates, against a budget of -0.89 MB.

### Not in this stage, and why

| Item | Decision | Reason |
|---|---|---|
| Camp captain, swarm creature, dungeon boss | **Block-outs only** (CALL-M5): a silhouette sheet and a size-and-budget row each, in slice 7. Final models in Stage 6. | They have no rules yet: no camp, no scale, no attack pattern, no dungeon to stand in. A figure cannot be judged without them, and a model nothing uses is dead download. |
| Skinned meshes | Later stage, only if wanted | 6.1 |
| Authored clips per monster | Stage 6, for bosses | 6.5 |
| A new original hero in place of Kai | Owner decision (CALL-M4); not recommended now | Every hero contract and the gear mount space hang on this body |
| World props | Out | 4.4 |
| Model compression | Stays shelved | 9.2 |
| Renaming borrowed names in node names (`Gear_bandos-chest`, `Monster_elvarg_dragon`) | Out | "Names stay as they are"; they are also contracts |

### Hand-off to Stage 6

Stage 6 receives: the safe pipeline and review loop; `figkit.py`; the budget classes of 9.1 with the three reserved rows of 9.2; the contract for a new monster (one `Monster_<model key>` node, the seven pivot names, optional pivots, a pose-table row, a manifest entry, a credit row if third-party); the art direction of section 5; and the three block-out sheets. A new monster is then: one builder function, one data row, one review.

### 10.3 Guards (slice 3) in detail

`createCastleGuard` builds each guard from `buildHumanoidRig` upgraded with the hero GLB and dressed with existing gear visuals (helm, plate body, plate legs, kite shield, sword) in guard steel, the way the merchant is built. Positions, dialogue, hitbox, `userData` and `npcList` labels are unchanged. Guards gain the `Idle` clip. `public/models/guard.glb` and `scripts/blender/export_guard.py` are deleted. `blender/examples/knight_28541/` and its `CREDITS.md` line stay, moved to the "kept in the repository, not shipped" part, so `tests/credits.test.ts` stays green; this also takes the one asset with an unstated upstream licence out of the shipped game.

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

### 11.3 What are we going to do about it?

| # | Answer |
|---|---|
| T1 | Eliminate: builds cannot write into `public/` or `blender/` (7.1); promotion is a separate, named, explicit step behind the compare (7.2). |
| T2 | Mitigate: `--disable-autoexec` on every call, pinned by `tests/run-blender.test.ts`; `--factory-startup`; sources are data-linked by object name only (`libraries.load`), never opened as the session file, except the three files that are opened whole (Kai, the knight until slice 3). Accept: Blender itself parsing a hostile file; sources are added only by owner sign-off (K6). |
| T3 | Mitigate: every zip member's resolved path must start with the extraction directory, else the build stops. |
| T4 | Mitigate: the manifest and its test (7.2, 8.3) check exact names, parents and positions; the compare refuses promotion. |
| T5 | Mitigate: budgets in the manifest test and in the compare; a file over 8 MiB raw is refused outright. |
| T6 | Mitigate: `tests/credits.test.ts` plus a new assertion that every directory under `blender/examples/` has a licence file and a `CREDITS.md` row; the licence list of 6.2. |
| T7 | Eliminate: the `?v=` key is the file hash, kept equal by a test. |
| T8 | Mitigate: a test scans each GLB's JSON chunk for `/home/`, `/Users/`, `C:\` and the like; `.blend` files are saved with relative paths and no packed third-party textures. |
| T9 | Mitigate: one process, 3 GB cap, 10-minute timeout, in the plan's command table. An out-of-memory kill is a defect, never a reason to raise the cap. |
| T10 | Accept, with a control: structural compare, generator string printed in every report. |
| T11 | Mitigate: agents report measurements and file paths only; every slice ends at an owner step. |
| T12 | Mitigate: JPEG sheets, 2 MB per slice, checked by the slice's last task. |
| T13 | Mitigate: the compare parses the whole file and every accessor range before any check; promotion copies to a temporary name and renames. |

### 11.4 Did we do a good enough job?

Each answer above has a test or a refusing command, listed in the plan's task that builds it. The pipeline is proven by doing the dangerous thing safely first: slice 0 ends with a full rebuild of all five files into scratch, a compare report with zero contract differences, and nine unchanged hashes.

---

## 12. Save format and game rules

No change. No save field is read, written or migrated. No item, monster, stat, drop, formula, name or position changes. The band table (5.5) and the pose table (6.5) are look data. The three kit models attach to rows Stage 4 already created.

---

## 13. CALLs for the owner

Real trade-offs first.

| # | Decision | Recommendation, in plain words |
|---|---|---|
| CALL-M2 | **The guards.** (a) Build them from the hero body and existing armour and delete the knight model, or (b) keep the knight, reduced to 6,000 triangles. | **(a).** It saves 1.17 MB of 3.74, the guards match the rest of the game, they can breathe and shift, and the one model with an unclear upstream licence leaves the game. With (b) you keep the realistic knight look and save 0.9 MB. What you lose with (a): that specific knight. |
| CALL-M4 | **The hero's identity.** Keep the current character (a third-party anime-style figure under CC-BY) and improve it, or commission a new original hero body by script. | **Keep and improve** in this stage. Every piece of armour is shaped to this body. A new hero is a stage of its own and can use this pipeline. |
| CALL-M3 | **Rigid jointed figures or bending skinned ones.** | **Rigid, done well.** It is the old-school look, and it keeps every system that already works. Bending limbs would mean rewriting how figures are loaded, outlined, dressed and animated. |
| CALL-M5 | **The three future monsters** (camp captain, swarm creature, dungeon boss): build them now or with Stage 6. | **Shape studies now, final models in Stage 6**, when they have rules, a size and a place to stand. The download room for them is reserved. |
| CALL-M7 | **The dragon.** Reduce the existing third-party dragon to 14,000 triangles and give it colour and detail, with Ashmantle as its own kit on the same body; or build a new dragon from scratch. | **Reduce and dress.** A scripted dragon from primitives risks looking mechanical. The credit to its author stays. |
| CALL-M6 | **Two new hero animations** (`Hurt`, `Death`). This replaces one frozen test assertion and adds a few lines of engine code. | **Yes to `Death`**: today the hero stands upright behind the death screen. **`Hurt` is optional**: Stage 4 already leans and pushes the hero on a heavy hit; the clip adds arms, head and knees to that and never interrupts a swing. Take it if the lean alone looks stiff at OM-S1. |
| CALL-M8 | **New third-party models**: allowed only as a fallback, CC0 or CC-BY, one sign-off each. | **Yes, as stated in 6.2.** |
| CALL-M9b | **Compression** stays shelved. | **Yes.** This stage removes about as many bytes without a decoder. |
| CALL-M1 | The essence list of section 1. | Confirm. |
| CALL-M9 | Any Blender 5.x may build a shipped file; the manifest decides, not the version. | **Yes.** Otherwise only the Windows machine could ship models. |
| CALL-M10 | `.blend` files: promote each only together with its GLB, saved without the packed third-party textures (`hero.blend` is 11.7 MB today). | **Yes.** The scripts are the source; the `.blend` is a convenience for opening the result. |
| CALL-M11 | Vertex colour as the paint layer, with one small engine flag after Stage 5. | **Yes.** It is the cheapest richness available, and textures cannot be used (K2, K3). |
| CALL-M12 | The art direction of section 5, including the three gear bands. | Confirm after seeing the baseline sheets (plan step OM-1). |
| CALL-M13 | Review sheets are committed, 2 MB per slice at most. | **Yes.** |

---

## 14. Risks

| Risk | Likelihood | Answer |
|---|---|---|
| Stages 4 and 5 land differently from their designs (the `model` field, `facetMaterial`, `photo.ts`, run-time merging). | Medium | Plan task R0 re-checks every premise first and amends this document before any other task. |
| Run-time merging in Stage 5 already merges figure meshes, making 6.4 redundant, or drops `COLOR_0`. | Medium | Stage 5 merges world props only (its 6.6); R0 confirms. Build-time merging is still worth it for bytes and for gear. |
| Vertex colour multiplies badly with the banded light or the albedo tiles (too dark, dirty). | Medium | The bake strength is one number per figure; judged on the hero first, in engine, before any monster uses it. |
| Procedural creatures still look mechanical after the rework. | Medium | The three-read sheets catch it per slice; fallback is CALL-M8. |
| Software-rendered captures mislead about colour. | High | Stated in every capture's README; the owner's look on a real GPU accepts the slice. |
| Decimating third-party bodies breaks their UVs or leaves holes. | Low | UVs are re-projected by the engine anyway; holes show on the turnaround sheet. |
| Kits that share mesh data are exported as copies, so a variant costs a full body. | Medium, not verified | Plan task D1 measures it first. Fallback: the engine clones the base node and adds the kit node, which Stage 4's `model` field almost does already. |
| Art tasks cannot be fully specified, so they are not agy work and cost more. | Certain | Mechanical tasks (pipeline, merging, wiring) go to agy; the art builders stay with Claude; one figure sets the pattern before the rest. |
| The vertex bake is noisy, or its bytes break a budget. | Medium | Measured: 5.3 s for a figure, +26% wire on unchanged geometry. Noise is judged on the hero first; the fallback is a crease-and-height gradient with no ray tracing, which is smooth and compresses better. |

---

## 15. What could not be verified

- How any figure looks **in the game**: no browser, no dev server, no capture was run. Every judgement of "weak" in section 4 comes from Blender renders of the GLB with its own base colours, plus the code.
- Anything on a real GPU, and any frame time.
- Stage 4 and Stage 5 code. Neither is on this branch; their designs were read.
- How the baked vertex colour **looks**, in Blender or in the game. The bake, its time, its export and its byte cost on one unchanged figure were measured; the claim that reworked figures absorb the cost was not.
- `tests/textures.test.ts` and `tests/dispose.test.ts` were not read in full. Stage 5's design says they pin the outline shells and the material parameter filter; R0 lists every assertion that touches a figure material before H6b starts.
- Whether linked mesh data exports as shared accessors (the kit technique's byte claim).
- `run-blender.mjs export` on a `.blend` saved by Blender 5.2.
- The live server's exact Brotli level; quality 3 matches it within 0.7%.
- Draw-call and triangle counts in a running scene; the figures here are per file.
- Whether the knight's upstream terms are a real problem; the design only removes the question.
- The byte numbers of slices 1, 2, 4, 5 (kit) and 6 are estimates. Measured: today's files, the guard at 6,000 triangles, the dragon body at 12,000, the goblin's merge.
