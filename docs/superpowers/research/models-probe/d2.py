import sys; sys.path.insert(0, sys.argv[1])
from lib import Doc
d = Doc('/path/to/osrs-like-wp/MP/docs/superpowers/specs/2026-11-14-models-pass-design.md')
d.sub("(section 8).\n\n---\n\n---\n\n## 2. Constraints", "(section 8).\n\n---\n\n## 2. Constraints")

d.sub("weapons 20% larger. The hero keeps the `LEAN_RIG` pivots exactly (8.1).", "weapons 20% larger. The hero's shoulders, hips, elbows and knees stay at the `LEAN_RIG` positions (8.1).")

d.between("It is built as a **kit**:", "### 5.7 Motion", r"""It is built as a **kit**: a clone of the base figure plus two or three rigid pieces of its own, each attached to the base bone it is named after (measured: a second skinned body is not shared on export, 3.5 S12, so a kit is the only cheap variant). Saltback Stalker: salt-crusted back plates, a forked double sting, heavier claws. Thornwatch Marksman: a thorn-wreathed hood, a tall bramble quiver, a longer bow.

**Ashmantle is not a kit** (owner, 2026-11-14: the dragon is rebuilt and Ashmantle gets its own model). It is a second body on the dragon skeleton: heavier in the chest, a slag crown fused to the skull, back plates with glowing seams, a clubbed tail. It shares the dragon's bones, clips and nothing else, and it must pass the same test against the dragon as any variant: a different black cut-out at 85 px.
""")

d.between("### 5.7 Motion", "---\n\n## 6. Technique", r"""### 5.7 Motion

- **Smooth, not held** (owner, 2026-11-14: "smooth"). Clips are authored on a twelve-a-second pose grid, few strong poses with eased moves between them, and exported as one `LINEAR` key per frame at 24 a second (measured, 3.5 S3), so the game interpolates. No `STEP` clip is built.
- **Every attack has three beats**: anticipation (the body goes the other way first), the strike (two frames), the follow-through with a settle.
- **The torso and head lead.** A swing starts in the hips and chest and the arm arrives last.
- **Joints bend.** Elbows and knees are real joints now: a swing folds the forearm, a step folds the knee, a hit folds the spine. This is the visible gain of skinning in motion.
- **Idle is alive**: weight shift, breath, a look around, and one small trait per species where a task adds it (the goblin scratches, the giant rolls a shoulder).
- **One library per skeleton** (6.5): a figure does not get animations of its own unless its silhouette needs one. A goblin swings with the hero's `Slash`; Ashmantle bites with the dragon's `Bite`.
- Stage 4's reactions (hit stop, flash, flinch, knock-back, wind-up pose) are drawn by the engine from events, on the same bone names they used as pivots (6.1.3).
""")

d.sub("| A deliberate retro choice, not mainstream practice; the owner should read CALL-M3 that way. It is what the engine, the gear and Stage 4 are built on. |",
"| **Superseded by the owner's decision of 2026-11-14: every figure is skinned (6.1).** The design now follows mainstream practice here. |")
d.sub("| Rigid segments with joint caps (6.1) |", "| Skinned meshes on three shared skeletons (6.1) |")
d.sub("| Pose tables (6.5), D-4 | Mainstream with an open taste choice. |", "| Pose tables sampled to smooth clips, one library per skeleton (6.5) | Mainstream; shared rigs and shared clips are how games with large rosters afford them. |")
d.sub("| Gear on pivots; bands (5.5) | Mainstream; good. |", "| Rigid gear pieces on bones (6.1.4); bands (5.5, follow-up stage) | Mainstream; good. |")

d.between("### 6.1 Segmented figures on named pivots, not skinned meshes (CALL-M3)", "### 6.3 Colour: named materials plus vertex colour, no textures", r"""### 6.1 Every figure is a skinned mesh on a shared skeleton (decided 2026-11-14)

The owner's words: "Mesh that bends for everything, including the hero. It makes it easier for us to reuse some things, if possible." This replaces the earlier recommendation (rigid segments). The rest of 6.1 is the design of that decision.

#### 6.1.1 The rule that makes it affordable: a bone is the pivot it replaces

Three rules, each checked by the manifest (7.2):

1. **Same names.** A bone carries the name of the pivot it replaces: `Torso`, `HeadGroup`, `LeftArmPivot`, `RightElbowPivot`, `LeftKneePivot`, `LWing` and so on; in `monsters.glb`, where several figures share a file, `<model key>_<Bone>`, exactly as today's pivots are named (`goblin_HeadGroup`).
2. **World-aligned rest.** Every bone's rest rotation is identity: in Blender every bone points straight up with roll 0. Measured (3.5, S1): the joints export with no rotation. A bone's local axes are then the figure's axes, as a pivot empty's are today.
3. **The bind pose is the designed rest pose**: the pose the figure shows with every rotation at zero (the lean of 5.3, arms down and outside the outline). Today's monsters work the same way.

What follows from them:

| Code that exists | What it does | With bones |
|---|---|---|
| `findPivot`, `getObjectByName` (`blenderMonsters.ts`, `blenderHero.ts`) | find a pivot by name | finds the bone; a `Bone` is an `Object3D` |
| `poseMonsterLimbs` (`monsterMeshes.ts`) | writes `rotation.x` / `.y` / `.z` on pivots | writes the same numbers on bones, same axes, and the skin bends instead of a rigid part turning |
| Stage 4's torso lean, knock-back offset and wind-up pose (its 6.5) | additive rotation on `Torso`, `HeadGroup`, arm or wing pivots; an offset on the figure's group | unchanged for figures posed in code; applied after the mixer for figures driven by clips (6.1.3) |
| Gear mounting (`playerMesh.ts` 194-330) | adds a rigid group under the elbow, knee, head, arm, leg or torso pivot at a fixed offset | adds it under the bone of the same name at the same offset (measured: a rigid child of a bone follows it, 3.5 S5) |
| The hero's clip functions (`build_hero.py` 121-416) | key rotations per pivot name | key the same rotations on pose bones of the same names |

And one thing that did not exist before: **a rotation-only clip plays on any figure with the same bone names, whatever its proportions, with no retargeting** (measured, 3.5 S4). That is what "reuse" rests on.

#### 6.1.2 Three skeletons serve everything

| Skeleton | Bones | Who stands on it | Where its clips live |
|---|---|---|---|
| **Biped** | 16: `Root`, `Hips`, `Torso`, `HeadGroup`; `LeftArmPivot`, `LeftElbowPivot`, `LeftHand` and the right three; `LeftLegPivot`, `LeftKneePivot`, `LeftFoot` and the right three. Optional: `Jaw`, `WeaponPivot`, `OffhandPivot`, `LWing`, `RWing`, `TailPivot`, `TailPivot2` | Hero, guards, merchants and every other townsperson (they are instances of the hero), goblin raider, goblin archer, dark wizard, dark ranger and Thornwatch Marksman, hill giant, moss guardian, lesser demon (with the wing and tail bones), chicken (wings on the arm bones). Stage 6: camp captain, dungeon boss | `hero.glb`, authored on the hero |
| **Dragon** (winged quadruped) | 22: `Root`, `Hips`, `Torso`, `Neck1`, `Neck2`, `HeadGroup`, `Jaw`; front legs `LeftArmPivot`, `LeftElbowPivot` and the right two; hind legs `LeftLegPivot`, `LeftKneePivot` and the right two; `LWing`, `LWing2`, `RWing`, `RWing2`; `TailPivot`, `TailPivot2`, `TailPivot3` | Dragon, Ashmantle. Later: any four-legged beast, with the wing bones left out | `monsters.glb`, authored on the dragon |
| **Crawler** (many-legged) | 20: `Root`, `Hips`, `HeadGroup`; claws `LeftArmPivot`, `LeftElbowPivot` and the right two; `LeftLegPivot` and `RightLegPivot` (each still swings its whole side, as today), plus optional per-leg bones `LegL1` to `LegL4`, `LegR1` to `LegR4`; `TailPivot`, `TailPivot2`, `TailPivot3` | King scorpion, Saltback Stalker. Stage 6: the swarm creature | `monsters.glb`, authored on the scorpion |

Proportions are free: a skeleton fixes names and hierarchy, not lengths. The giant's shoulders are wider and the goblin's legs shorter on the same sixteen names.

**What reuse buys, concretely:**

- **One clip library per skeleton.** The biped library (the hero's ten clips plus `Hurt` and `Death`) animates ten monster types and every townsperson. A goblin walks with `Walk`, swings with `Slash`, a ranger shoots with `Ranged`, a wizard casts with `Cast`, and each plays `Hurt` and `Death`. That is twelve authored clips for about thirteen figures, where one clip set per figure would be over a hundred. A clip is about 1 to 4 kB on the wire (3.5 S9).
- **Shared attack and hit-reaction motion.** Stage 4's wind-up pose becomes the attack clip's own anticipation, held (6.1.3), so the telegraph and the strike are one motion.
- **Kits.** A variant is a base figure plus rigid pieces on its bones (5.6).
- **Future monsters cost a mesh and a data row.** Stage 6's captain and dungeon boss arrive on the biped rig already able to walk, swing, flinch and fall; the swarm creature arrives on the crawler rig.
- **One gear system for every biped.** The guards wear the player's armour through the player's own mounting code (10.3); any biped monster could hold a real weapon from `gear.glb` later.

What reuse does **not** buy: a creature whose skeleton differs (a snake, a bat) needs a fourth rig and its own clips.

#### 6.1.3 The engine side (three 0.169)

| Concern | Today | With skinned figures | Evidence |
|---|---|---|---|
| Clone | `template.clone(true)` | `SkeletonUtils.clone` (three's own `examples/jsm/utils/SkeletonUtils.js`; no new dependency). After the clone the engine strips the `<model key>_` prefix from bone names, so every instance has canonical bone names. | S5: `clone(true)` leaves the copy bound to the original's bones. S11. |
| Both kinds at once | | The loader branches on what it finds: a node with a `SkinnedMesh` under it takes the skinned path, any other the rigid path. A figure migrates by promoting its file; no flag, no list. | 6.1.5 |
| Materials by name | one material per mesh, chosen by material-name family | unchanged; a skinned figure has **one skinned mesh per material family** (hide or skin, cloth, hard, glow, eyes), not one per part | 6.4 |
| Banded light | `facetMaterial` patches the Lambert shader in `onBeforeCompile` | Today's patch writes its normal after `beginnormal_vertex`, **before** three applies the skin, so bands would be lit from the bind pose (measured). Stage 5's model (its 6.1) deletes that patch and bands inside `RE_Direct_Lambert`, using three's own normal, which is skinned: correct by construction. R0 confirms which of the two landed; if any custom normal varying survives, it moves after `skinnormal_vertex`. Three compiles a separate program for skinned use of the same material (`WebGLPrograms.js` 311), so one material instance can serve both. | S7 |
| Vertex colour, albedo tiles | `vertexColors`, projected UVs written per instance | unchanged: both are per-vertex data that travel with the skin. The projection uses rest-pose positions. | |
| Outline shell | a plain `Mesh` sharing the geometry, with a raw `ShaderMaterial` | For a `SkinnedMesh` the shell is a `SkinnedMesh` bound to the **same skeleton** (`shell.bind(mesh.skeleton, mesh.bindMatrix)`), and the outline material gets a skinned variant whose vertex shader includes three's four skinning chunks. Plain meshes keep today's shell, so the three frozen tests that read a shell stay green. | S5, S7: as written the outline stays in the bind pose |
| Frustum culling | geometry bounding sphere | Each skinned mesh gets a **fixed** sphere at load: the rest-pose sphere with its radius times 1.5 (covers a raised weapon and a fall). Never recomputed per frame. | S6: three computes the sphere once and never refreshes it |
| Clicks | `intersectObjects(G.worldInteractiveObjects, false)` on invisible hitboxes (`input.ts` 207, 249, 381; `spawns.ts` 75) | **unchanged.** No ray is ever cast at a figure's mesh. | read in the code; S6 shows a skinned raycast works but costs 9 ms |
| Shadows | every mesh casts | unchanged; three's depth material applies the skin itself (`depth.glsl.js` includes the skinning chunks). One shadow call per skinned mesh. | S8 counts both passes |
| Disposal | `disposeObject3D` frees geometries and materials | also calls `skeleton.dispose()` for each skinned mesh (it frees the bone texture). Monsters respawn, so this is not optional. | `Skeleton.dispose` exists; the bone texture is created on first render |
| Hero animation | `BlenderHeroAnimator`: an `AnimationMixer` over clips that target pivots by name | **unchanged class.** The clips target bones of the same names. | S5 |
| Monster animation | `poseMonsterLimbs` writes pivots every frame | First: unchanged, on bones (the pilot proves it). Then, for biped monsters, the same animator class as the hero, fed the hero file's clips (6.5). Dragon-rig and crawler-rig figures get the same once their libraries exist. | S4 |
| Stage 4's reactions | flinch and wind-up write pivot rotations; knock-back offsets the group; hit stop freezes pose time | For figures still posed in code: unchanged. For figures driven by clips: (1) lean, flinch and knock-back are **added after `mixer.update`**, the way Stage 4 already leans the hero's torso without interrupting a swing; (2) hit stop is the animator skipping its update for the frozen time; (3) the **wind-up pose is the attack clip itself**, paused and scrubbed from its start to its anticipation key by wind-up progress, then released on the strike. The manifest records each attack clip's anticipation time. | Stage 4 design 6.5; R0 reads how it landed |
| Per-frame cost | 22 to 68 matrices and draw calls per monster | 16 to 22 bone matrices and one small bone texture per figure; 2 to 4 draw calls per pass | 6.4 |
| Placeholder rigs | `buildHumanoidRig` and the procedural monster builders show until the GLB resolves, or if it fails | unchanged; they stay rigid. They are the fallback, not the figure. | `lean-rig.test.ts` stays green |

#### 6.1.4 Gear on a skinned hero

**Rigid pieces attached to bones** is the standard technique for armour and weapons, and it is what the game already does with pivots. Every piece of `gear.glb` stays a rigid group mounted on the bone that has its pivot's name, at today's offset: weapon, ring and gloves on the elbow bones, boots on the knee bones, helm on `HeadGroup`, body pieces on `Torso` and the arm bones, leg pieces on `Torso` and the leg bones. `gear.glb`'s node names and mount spaces do not change. What changes for the eye: the body under the armour now bends at elbow and knee, and the rigid pieces overlap at the joint as plate does.

Two offsets move, in one place: `HeadGroup` sits at the top of the head today (1.86) and becomes the neck joint (about 1.60, taken from the source's own `neck` bone), because a skinned head must turn about the neck. The helm and hat offsets are shifted by the same amount inside the one mounting function that the player, the merchants and the guards share (10.3), and a test pins the helm's rest position in the figure's space to today's.

**Hiding body parts under armour** stays by name, and the names stay: `Hair` is a rigid mesh on the head bone (hair on this figure does not need to bend); `TorsoCoat` and `InnerCollar` are their own skinned meshes. A skinned mesh hangs under the figure's root, not under a bone, so the two hide loops (`playerMesh.ts` 232-240, 259-270) search the figure's group instead of the head and torso pivots: a one-line change each, covered by a test. The hero is therefore **not one draw call**: it is about eleven meshes (head, hair, eyes, inner shirt, coat, belt, sleeves, bracers, hands, legs, boots) where it is eighteen today, because the engine recolours five of its materials when armour is worn (`tunicMat`, `legsMat`, `bootMat`, `gloveMat`, `bracerMat`) and hides two by name.

**Which gear should itself be skinned, and what that costs.** Pieces that span a joint or hang as cloth look stiff when rigid: the robe skirt (`robe-skirt`), capes, trousers and chaps across the knee, long sleeves. A skinned gear piece must be authored against the hero's skeleton, exported with weights, cloned with the skeleton utility and **bound to the wearer's skeleton at mount time** instead of being added under one bone; its outline shell and culling sphere follow the rules above; and `gear.glb` must then carry a copy of the biped armature. That is a second mounting path and new weights for each such piece. **None of it is in this stage**: every gear piece stays rigid, exactly as mounted today, and skinned gear is the first item of the follow-up stage (section 10).

#### 6.1.5 Migration without a big bang

The game works after every step, because the loader takes the skinned path only for a figure whose file carries a skin.

| Step | What moves | The game after it |
|---|---|---|
| 1 | **The pilot: the goblin raider**, rebuilt and skinned, posed by today's `poseMonsterLimbs` on its bones. The engine gains the skinned path (clone, outline, culling sphere, disposal), with every other figure untouched. | One skinned monster among rigid ones. If the owner rejects the approach here, one figure and one engine branch are reverted. |
| 2 | **The hero**, with its author's weights, its clips re-authored on bones, gear mounted on bones. Merchants and the other townspeople follow automatically (they are the hero's file). **Guards** become two dressed instances. | Every human in town is skinned; the biped clip library exists. |
| 3 | **Dragon, Ashmantle, demon**: new models on the dragon and biped rigs. | The bosses move for the first time. |
| 4 | **Biped monsters switch from code poses to the shared clips**, then the remaining monsters are rebuilt or re-rigged group by group. | Fewer rigid figures at each promotion. |
| 5 | When the last rigid monster is gone, the rigid branch of `upgradeMonsterRigWithGltf` is deleted. | One path. |

**The hero's ten clips are re-authored on the rig by the code that already writes them**: the sample functions of `build_hero.py` return rotations per pivot name; the builder keys them on pose bones of the same names instead of on empties, and adds the elbow and knee bends a rigid figure could not show. They are not retargeted from anywhere. Position keys are dropped except on `Hips` (the body's rise and fall), so the clips can be shared (3.5 S4); the engine scales the `Hips` track by each figure's hip height.

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
""")

d.between("### 6.4 Draw calls: merge at build time", "### 6.6 Level of detail: none in this stage", r"""### 6.4 Draw calls: one skinned mesh per material family

A skinned figure does not need a mesh per moving part: the skeleton moves the parts. The builder's `merge_by_family` joins everything that shares an **engine material family** (the name rules of `blenderMonsters.ts` 103-136: glowing, eyes, hide or skin, cloth, leather, wood, bark, moss, stone, metal, plain) and an outline flag into one skinned mesh; rigid accessories (a club, a shield, a hat) are part of that mesh with weight 1 on their bone. It never merges across a name the engine toggles (8.1).

| | Today | Merge-only pass (plan M0) | Skinned |
|---|---|---|---|
| Goblin raider | 59 meshes | 29 (measured, 3.3) | **at most 4, target 3** (skin, leather and wood, metal; eyes are a fourth only where they stay unlit) |
| A camp of seven goblins, per pass | 413 | 203 | 21 to 28 |
| The same camp, colour and shadow pass | 826 (measured, 3.5 S8) | 406 | 42 to 56 (42 measured for seven figures of three) |
| Every monster of Stage 4's roster (42), per pass, if all were in view | about 1,700 | about 850 | at most 170 |
| Dragon | 5 | 5 | 3 (hide, horn and claw, glow) |
| Hero, undressed | 18 | | about 11 (6.1.4) |
| Hero in a full plate set | 62 | 32 after the gear merge | about 32: 11 of body, about 21 of gear |
| One guard | 27 (the knight) | | about 32, as the hero in plate |

**Can a figure be one draw call?** Yes: one material, with every colour in the vertex-colour layer (which the owner approved as the paint layer). Seven such figures were 14 calls a frame with shadows in the probe. The price is the engine's surface families: one material means one albedo tile and one side setting for the whole figure, so cloth, hide and metal stop answering light differently (5.4). The design takes **up to three families** per ordinary monster and leaves one-material figures for crowds (the Stage 6 swarm creature). The owner sees both on the pilot (decision N-4).

**Against the owner's 51 FPS on an RTX 4070.** That frame is probably bound by the CPU cost of draw calls, not by the GPU, but nobody has measured it. The numbers above say how large the lever is: a fight at a goblin camp drops by about 770 calls a frame, which is of the order of Stage 5's whole start-pose budget (at most 1,000 colour-pass calls on Medium, its section 10). The start pose itself changes little: the guards cost a few calls more than the knight, the hero a few fewer. Whether calls are what binds is tested **before** any skinning lands, by the merge-only pass.

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
| `Death` (new; owner: "ok", 2026-11-14) | 1.1 s, ends lying, last pose held | hero (today it stands upright behind the death overlay, `handlePlayerDeath`, `actions.ts` 361-375); biped monsters, inside the time their dying state already lasts |
| `Hurt` (new) | 0.35 s: arms and head recoil, knees give | The shared hit-reaction clip the owner's answer 1 asks for. On the hero it plays under Stage 4's lean only when no attack or skill clip is running, and never interrupts a swing. On monsters it is optional per figure; Stage 4's flinch numbers keep working without it. |

Two constraints come from the frozen test (`blender-hero.test.ts` 63-70): 0.2 s into `Walk` a leg bone has turned more than 0.01 rad on x, and 0.15 s into `Slash` at 1.2 speed the right arm has turned more than 0.05 rad on x. So "the arm arrives last" means the arm starts its wind-back at once, in the anticipation, and the torso leads the strike; both samples go into the manifest. Clip lengths stay within 10% of today's so `playAction` time scales still fit.

**The dragon library**, authored on the dragon, in `monsters.glb`: `Idle`, `Walk`, `Bite`, `WingBuffet` (the raised pose Stage 4's wind-up shows today, now a motion), `Hurt`, `Death`. Six clips for two bosses.

**The crawler library**, authored on the scorpion: `Idle`, `Walk`, `Strike`, `Hurt`, `Death`. Five clips for two monsters and Stage 6's swarm.

**How monsters get there.** The pilot and every figure promoted before its library exists are posed by `poseMonsterLimbs`, unchanged, on bones. The `if (typeKey === ...)` chain (`monsterMeshes.ts` 813-843) becomes a small data table per model key (plan M1b): which clips a model uses for idle, walk, attack and death, or, while it is still posed in code, today's numbers. A model whose row names clips gets an animator (the hero's class) and stops being posed in code. Rigid figures and code-posed skinned figures can coexist with clip-driven ones for as long as the migration lasts.

Per-species idle traits and second attack clips are not in this stage. A boss that needs a move of its own in Stage 6 adds one clip to its rig's library.
""")
d.save(); print('d2 ok')
