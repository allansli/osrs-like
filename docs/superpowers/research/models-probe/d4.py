import sys; sys.path.insert(0, sys.argv[1])
from lib import Doc
d = Doc('/path/to/osrs-like-wp/MP/docs/superpowers/specs/2026-11-14-models-pass-design.md')
d.sub("---\n\n---\n\n## 9. Budgets", "---\n\n## 9. Budgets")

d.between("## 9. Budgets", "## 11. Threat model", r"""## 9. Budgets

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

Draw calls are in 6.4. Against Stage 5's budget (start pose at most 1,000 colour-pass calls on Medium, and the shadow pass at most 60% of its V2 capture): the start pose is about neutral (two guards at about 32 each against the knight's 27 each; the hero and the townspeople lose a few), and every camp is far under (a goblin camp of seven falls from 413 calls a pass to at most 28). Triangles at the start pose fall by about 87,000 with the knight gone. The exact numbers need a running scene; the plan captures them at M0p, the pilot, N3 and X3.

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

Reserve handed on: Stage 6's captain, swarm creature and dungeon boss are about 0.51 MB as exported (0.35 MB with N-3), and the follow-up gear stage about 0.23 MB. **Without N-3 the total returns to about today's 3.76 MB after Stage 6 and passes it with the gear stage. With N-3 it stays near 3.2 MB.**

**Compression (was CALL-M9b; now decision N-3).** Three options, for the owner:

| Option | Saves | Costs |
|---|---|---|
| Nothing | 0 | The totals of the middle column |
| **8-bit normals, weights and colour on `hero.glb` and `monsters.glb`** (recommended) | about 30% of those two files, measured on a skinned figure (3.5 S10): about 0.58 MB | One plain node script of about 60 lines run inside the promote step; one glTF extension (`KHR_mesh_quantization`) that three's loader reads with no decoder and no dependency; the frozen tests parse it with the bare loader (measured). Positions stay floats, because the engine projects albedo UVs from them in metres. Worst posed-vertex error measured: 0.5 mm |
| Revive the shelved design (meshopt and 8-bit normals on all five files) | 32% of everything, by its own measurement on rigid files | A decoder wired into the loader (25 kB of script), four pinned dev dependencies, a second set of committed files, and the frozen tests can no longer read the shipped files with a bare loader. It was measured on files without skins and would need re-measuring |

Recommendation: the middle option now; leave the shelved design shelved. Revisit it only if the total passes 3.76 MB again.

Per-figure numbers are ceilings from one measured probe body, not from the real figures: the pilot measures the first real one and resets the table before any other figure is built.

### 9.3 Load time and memory

Parse time follows raw bytes: 11.9 MB today, about 9.8 MB after as exported (about 8.3 MB with N-3). GPU and heap memory per instance fall with the mesh count (4.5). Each skinned instance adds one bone texture of a few hundred bytes. No new request is added: `guard.glb` is one fewer.

---

## 10. Scope: slices in order

The stage is much bigger than it was: every figure is rebuilt or re-rigged, the engine gains a second way to load and draw a figure, and three clip libraries are authored. So the first slice a player can see is a **pilot**: one figure, skinned, in the game, end to end, before anything else commits to the approach. Each slice is showable alone and ends with before and after sheets, an in-engine capture, and the owner's look.

| # | Slice | Why here | What the owner sees | Effort |
|---|---|---|---|---|
| 0 | **Safe pipeline and review loop**; contract manifests; baseline sheets of everything; the vertex-colour flag in the engine (inert until a file carries `COLOR_0`) | Nothing can change safely or be judged without it | Sheets of today's figures | 11 tasks, small |
| 0b | **Merge-only pass over every monster** (no shape change) | The cheapest test of whether draw calls are what holds the frame rate (6.4) | Nothing changes on screen; the draw-call counter and the frame rate at a goblin camp, before and after | 2 tasks, small |
| 1 | **Pilot: the goblin raider, rebuilt and skinned, in the game.** The figure kit (rig, body, weights, merge by family); the engine's skinned path; the contract tests for skins | Proves the whole chain on one cheap figure: script to file to loader to outline, shadow, culling, Stage 4's reactions on bones. A goblin is the first thing a new player fights | **The first visible result: a goblin whose arms, legs and back bend**, beside today's goblins, at the camp | 8 tasks, medium |
| 2 | **Hero**: skinned with its author's weights; twelve smooth clips on bones (ten re-authored, `Death`, `Hurt`); gear mounted on bones; the paint layer; townspeople follow | On screen every second of play; creates the biped clip library | The hero bending at elbow and knee in every action, in and out of armour; falling on death | 11 tasks, large |
| 3 | **Gear merge and guards**: gear meshes merged with no shape change; guards built from the hero and armour; `guard.glb` and the knight's `.blend` deleted | Pays for the download; the guards need the merge or they cost 62 calls each | Two guards who breathe, in guard steel; 1.17 MB less | 6 tasks, small |
| 4 | **Dragon (new), Ashmantle (its own body), lesser demon (rebuilt)**, with the dragon clip library (owner: dragon and demon first among the monsters) | Two bosses and the demon stand still today | Bosses that walk, bite, raise their wings and fall | 9 tasks, large (the hardest art) |
| 5 | **Biped monsters on the shared clips**; goblin archer rebuilt; chicken re-rigged | The start region; this is where reuse becomes visible | Goblins swinging and falling with the hero's own motions | 6 tasks, medium |
| 6 | **Scorpion** re-rigged on the crawler rig with its library; **dark wizard and dark ranger** rebuilt; **kits** for Saltback Stalker and Thornwatch Marksman | Mid game | A tail that strikes, a robe that swings, two variants with outlines of their own | 7 tasks, medium |
| 7 | **Hill giant and moss guardian** re-rigged | Late game | The last two figures | 3 tasks, medium |
| 8 | Rigid monster path removed; final budgets; hand-off | | | 3 tasks, small |

About 66 tasks with the premise re-check, against 56 before, and the art tasks are larger.

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

`createCastleGuard` builds each guard from `buildHumanoidRig` upgraded with the hero GLB (now a skinned instance) and dressed with existing gear visuals (helm, plate body, plate legs, kite shield, sword) in guard steel. The merchant mounts only a hat; a full set needs the mount offsets and hide rules of `rebuildPlayerEquipmentMeshes` (`playerMesh.ts` 93-350), so those are moved into one exported `mountLoadout(rig, items)` that the player, the merchants and the guards all call (no copy; the hero slice does the move, because the helm offset changes there, 6.1.4). Positions, dialogue, hitbox, `userData` and `npcList` labels are unchanged. Guards play `Idle` from the biped library. `public/models/guard.glb` and `scripts/blender/export_guard.py` are deleted, and so is `blender/examples/knight_28541/knight.blend` (owner: "ok", 2026-11-14). `blender/examples/knight_28541/LICENSE.txt` and the knight's `CREDITS.md` line stay, moved to a "source removed; credit kept" part, so `tests/credits.test.ts` stays green (it pins only the licence file and the credit line); this takes the one asset with an unstated upstream licence out of the game and out of the public repository.

---
""")
d.sub("---\n\n\n## 11. Threat model", "---\n\n## 11. Threat model", count=d.t.count("---\n\n\n## 11. Threat model"))

d.sub("| T13 | A malformed GLB from a half-finished build is promoted. |\n",
"| T13 | A malformed GLB from a half-finished build is promoted. |\n| T14 | A skinned figure is cloned the old way: every instance is bound to the template's bones, so all goblins move as one or the template is corrupted (measured, 3.5 S5). |\n| T15 | A file ships with bad skin data (weights that do not sum to 1, a joint index outside the skin, more than 4 influences, a bone that deforms nothing): vertices fly to the origin, or a figure stands still as the old dragon does. |\n| T16 | Bone textures leak when monsters respawn, because disposal does not know about skeletons. |\n| T17 | A skinned figure vanishes at the edge of the screen: its culling sphere is the rest pose's and the pose has left it (measured, 3.5 S6). |\n| T18 | A third-party rigged source brings a licence problem or a hostile file, now that such sources are allowed for rigs too. |\n")
d.sub("| T13 | Mitigate: the compare parses the whole file and every accessor range before any check; promotion copies to a temporary name and renames. |\n",
"| T13 | Mitigate: the compare parses the whole file and every accessor range before any check; promotion copies to a temporary name and renames. |\n| T14 | Eliminate: one helper clones skinned templates, and `tests/skinned-figure.test.ts` poses two instances and checks the template stayed at rest. |\n| T15 | Mitigate: the manifest test validates every skin of every shipped file (7.2); `tests/monster-motion.test.ts` requires every bone a motion row names to carry weight. The compare refuses promotion. |\n| T16 | Mitigate: `disposeObject3D` disposes skeletons; the same test asserts it. Stage 5's leak budget (GPU resources return to the start value after 200 attacks) is re-run at X3. |\n| T17 | Mitigate: a fixed sphere of 1.5 times the rest radius per skinned mesh, asserted by the same test; the owner's walk through every camp at each slice is the check that nothing pops. |\n| T18 | Mitigate: as T2 and T6: CC0 or CC-BY only, licence file beside the source, credit row, one owner sign-off per asset, opened with `--disable-autoexec` and `--factory-startup`, data-linked by name. |\n")

d.sub("No change. No save field is read, written or migrated. No item, monster, stat, drop, formula, name or position changes. The band table (5.5) and the pose table (6.5) are look data. The three kit models attach to rows Stage 4 already created.",
"No change. No save field is read, written or migrated. No item, monster, stat, drop, formula, name or position changes. The motion table (6.5) is look data. The optional `kit` and `body` fields (8.2) are look fields on rows Stage 4 already created, and no model key changes. Skinning changes how a figure is drawn and nothing about where it is, how large its hitbox is, or when it acts.")
d.save(); print('d4 ok')
