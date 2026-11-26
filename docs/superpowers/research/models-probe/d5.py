import sys; sys.path.insert(0, sys.argv[1])
from lib import Doc
d = Doc('/path/to/osrs-like-wp/MP/docs/superpowers/specs/2026-11-14-models-pass-design.md')

d.between("## 13. CALLs for the owner", "## 15. What could not be verified", r"""## 13. Decisions

### 13.1 Decided by the owner on 2026-11-14

Answers are quoted as given (translated where the owner wrote in Portuguese).

| # | Decision | The owner's words | What it does here |
|---|---|---|---|
| CALL-M3, D-1 | Rigid jointed figures, or meshes that bend | "Mesh that bends for everything, including the hero. It makes it easier for us to reuse some things, if possible." | **Every figure is a skinned mesh on a skeleton**: hero, guards, every monster, the bosses. This overrides the recommendation (rigid). Sections 6.1, 6.4, 6.5, 8, 9, 10. |
| CALL-M7 | The dragon | "Build a new one." And: "Any other mobs, we can rebuild. We have inspirations in games like RuneScape, Tibia, Ragnarok, etc. Whatever is needed, we rebuild." | The dragon is a new model. Ashmantle gets its own body on the dragon skeleton, not a kit. Section 4.6 decides the rest figure by figure: six rebuilt, five kept and re-rigged. "Inspirations" is read as spirit and technique, with original designs and no replica of any game's creature or character (K7). |
| CALL-M4 | The hero | "Ok" (keep the current one and improve it) | The hero keeps its body and identity and gets a skeleton and a skin from its author's own weights. |
| D-4 | Motion: held poses or smooth | "Smooth" | Clips are interpolated; no stepped clip is built; the one-clip style comparison is dropped (5.7). |
| CALL-M2 | The guards | "Pode refazer" (you may rebuild them) | Built from the hero body and armour; `guard.glb` is deleted (10.3). |
| CALL-M11 | Vertex colour as the paint layer | "Ok" | 6.3. |
| D-2 | Dragon and demon first among the monsters | "Ok" | Slice 4, straight after the hero and the guards (the pilot goblin before them is a test of the method, decision N-1). |
| CALL-M6 | A hero death animation | "Ok" | `Death` is added. `Hurt` was not asked separately; it is added as the shared hit-reaction clip that answer 1's reuse calls for, and stays optional per monster (6.5). |
| D-3 | Delete the knight's `.blend` once the guards are rebuilt | "Ok" | Deleted in slice 3; its licence note and credit line stay (10.3). |
| CALL-M8 | Third-party models as sources | Allowed, CC0 or CC-BY, recorded in `CREDITS.md` | 6.2 item 3, now also for rigged models. |

### 13.2 New decisions the answers create

| # | Decision | Recommendation, in plain words |
|---|---|---|
| **N-1** | **Which figure is the pilot.** One figure goes through the whole new chain before anything else commits to it: the goblin raider, the hero, or the new dragon. | **The goblin raider.** It is cheap to redo, it is the first monster a player meets, and it tests everything the method needs except worn gear. The hero is on screen all the time and carries ten animations and all the armour, so a failed first attempt there costs most. The dragon is the hardest shape to build by script, so a failure there would not tell us whether the method or the dragon was at fault. The dragon and the demon still come first among the monsters proper, as you decided. |
| **N-2** | **Split the stage.** It has grown from about 56 tasks to about 66 larger ones. Either keep gear bands (armour whose outline changes with its tier), gear clean-up and bending cloth gear in this stage, or move them to a follow-up stage. | **Move them to a follow-up stage.** This stage is then "skeletons and figures", and ends with every figure skinned. The follow-up is "gear": bands, and robes and capes that bend. Nothing in the follow-up is needed for the figures to work. |
| **N-3** | **Download size.** New skinned bodies weigh more than today's box figures. The stage still ends about 0.55 MB under today, but Stage 6 and the gear stage would bring the total back to today's 3.76 MB or over. A small build step that stores normals, weights and colours in 8 bits removes about 30% of the two figure files with no decoder in the game. | **Yes to the 8-bit step; keep the shelved compression design shelved.** Measured on a skinned figure: 30% smaller, read by the game's loader as it is, worst error half a millimetre. The shelved design saves about as much again but adds a decoder, four build dependencies and a second set of files. |
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
| The hero's author's weights do not survive the move to an arms-down bind pose. | Medium | Measured only in the source's own pose (3.5 S13). The first hero task proves the re-pose on a turnaround and a worst-pose sheet before any clip is authored; fallback: bind in the source pose and add the arm-down rotation to every clip. |
| Rigid gear on a bending body shows the body through the gaps at elbow and knee. | Medium | The armour recolours the body's materials to its own colour (today's behaviour), so a gap shows armour colour; the mount test pins positions; the hero slice captures the plate set in the worst poses. Skinned gear is the follow-up. |
| Shared clips look wrong on a figure with very different proportions (the giant's arms pass through its belly). | Medium | Rotations are shared, bone lengths are not; each figure's motion row may scale a clip's arm swing; judged per figure. A figure may get one clip of its own. |
| Two load paths live side by side for the whole migration and one rots. | Medium | The loader branches on the file's content, not on a list; `tests/skinned-figure.test.ts` covers both in one file; slice 8 deletes the rigid monster path. |
| The stage is too large to finish as one. | Medium | Every slice is promoted and playable alone; the pilot gates the rest; decision N-2 moves gear out. |
| Vertex colour multiplies badly with the banded light or the albedo tiles. | Medium | The bake strength is one number per figure; judged on the pilot, then on the hero. |
| Software-rendered captures mislead about colour. | High | Stated in every capture's README; the owner's look on a real GPU accepts the slice. |
| Skinning costs frame time instead of saving it. | Low | 16 to 22 bones per figure against 22 to 68 object matrices today; 2 to 4 draw calls against 22 to 68. The pilot's capture records calls and frame time at the camp. |
| Draw calls turn out not to be what limits the frame rate. | Unknown | The merge-only pass measures it first (6.4). The stage's case then rests on look and reuse. |
| The byte budget of 9.2 does not hold. | Medium | Ceilings come from one probe body. The pilot measures a real figure and resets them; N-3 is the lever. |
| Art tasks cannot be fully specified, so they are not agy work and cost more. | Certain | Mechanical tasks (pipeline, merging, wiring) go to agy; the art builders stay with Claude; one figure sets the pattern before the rest. |

---
""")
d.sub("---\n\n\n## 15. What could not be verified", "---\n\n## 15. What could not be verified", count=d.t.count("---\n\n\n## 15. What could not be verified"))

d.between("## 15. What could not be verified", "## Review log", r"""## 15. What could not be verified

- How any figure looks **in the game**: no dev server, no build and no in-engine capture was run. Every judgement of "weak" in section 4 comes from Blender renders of the GLB with its own base colours, plus the code.
- Anything on a real GPU, and any frame time. The claim that the owner's 51 FPS is bound by draw calls is a guess until the merge-only pass measures it.
- Stage 4 and Stage 5 code. Neither is on this branch; their designs were read. In particular: what `facetMaterial` looks like after Stage 5, and how Stage 4 applies the hero's lean over a running clip.
- **Skinning in the game's own engine code.** The experiments of 3.5 used three's loader, clone utility and mixer directly, and copies of the two shaders in a headless browser. `upgradeMonsterRigWithGltf`, `upgradeHumanoidRigWithGltf`, `addCartoonOutline`, `sealAlbedoUvs` and `poseMonsterLimbs` were read, not run, against a skinned file.
- **The quality of scripted figures.** The probe body is a limbed blob with no head, hands, clothes or weapon. That automatic weights bend it cleanly says little about a wizard's robe or a dragon's wing. No rebuilt figure exists yet, and none was drawn.
- **The hero re-posed.** Its author's weights were folded and bent in the source's own pose, at thumbnail size, as ten separate meshes; seams between those meshes under a bend were not inspected, and the arms-down re-bind was not run.
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
""")
d.sub("---\n\n\n## Review log", "---\n\n## Review log", count=d.t.count("---\n\n\n## Review log"))

d.t = d.t.rstrip('\n') + r"""

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
| Decisions | Ten marked decided with the owner's words; four new ones (N-1 pilot figure, N-2 stage split, N-3 8-bit attributes, N-4 one or three draw calls per monster) | 13 |
| Threats and risks | Skinned-clone, bad-skin-data, bone-texture leak, stale culling sphere and rigged third-party sources added; risks rewritten | 11, 14 |
"""
d.t += "\n"
d.save(); print('d5 ok')
