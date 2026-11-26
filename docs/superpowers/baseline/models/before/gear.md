# gear.glb, before

Shipped `public/models/gear.glb`, rendered on Blender 5.0.1, exit 0. Sheets in `gear/`. Claims are design sections 1 (fact 4) and 4.3, quoted; no judgement is added (plan 0.3 rule 6).

**How these were made, and a gap in the tool.** `scripts/blender/review_scales.json` has no gear entries, and the renderer stops on a figure without a scale. V3 may not edit that file, so the sheets come from a scratch copy of `scripts/blender/` (`review_render.py` and `paths.py` unchanged, the scales table plus the eleven gear roots at 1.0), run as `--python scratch/v3/tool/scripts/blender/review_render.py -- public/models/gear.glb scratch/v3/gear --only <the eleven roots>`. 1.0 is the in-game scale: `blenderGear.ts` sets `cloned.scale.set(1, 1, 1)` and mounts the piece on the hero, whose scale is 1.0. A follow-up task is needed to add the gear roots to the committed table. In `Gear_neitiznot-helm-turnaround.jpg` the face opening shows in the first (front three-quarter) view at the side, not facing the camera; the cause was not established.

**Clipped sheet.** `Gear_platelegs_legL-turnaround.jpg` is cut by the top edge of its tiles (logged 512 px in a 512 tile); 512 is a lower bound.

**Which pieces.** The plan asks for "the six shared silhouettes and five named pieces". Six shared: the fall-through shapes of `gearSilhouette` (`playerGear.ts`) that every metal tier collapses onto (fact 4: "every metal helm is `Gear_helm`, every plate body `Gear_plate-body`, every scimitar `Gear_scimitar`"): `Gear_helm`, `Gear_plate-body_torso`, `Gear_platelegs_legL`, `Gear_kiteshield`, `Gear_scimitar`, `Gear_boots_L` (one side of each L/R pair). Five named in 4.3: `Gear_mace` ("heaviest: mace 2,908 triangles"), `Gear_staff` ("staff 2,856"; "a staff is 11 meshes"), `Gear_neitiznot-helm` ("a helm of 2,768 triangles", the only helm at that count), and the two third-party blades not already in the six, `Gear_sword` (`sword_a`) and `Gear_greatsword` (`sword_f`); the third blade, `Gear_scimitar` (`sword_b`), and the pack's shield, `Gear_kiteshield` (`shield_b`), are in the six (`build_gear.py`, `build_weapons`, `build_shields`).

| Design says | Look at | Measured |
|---|---|---|
| "Tiers share one shape" (4.3, fact 4) | the six shared turnarounds; `roster-silhouette.jpg` | not measured here; `gearSilhouette` (`playerGear.ts`) maps every tier of a slot to these roots, and the tier is `item.color` |
| "the three third-party blades have ragged edges that shimmer" | `Gear_scimitar-`, `Gear_sword-`, `Gear_greatsword-turnaround.jpg` | shimmer is motion and is not visible in a still |
| "a helm of 2,768 triangles sits on a head 40 pixels wide" | `Gear_neitiznot-helm-play-distance.jpg`, `Gear_helm-play-distance.jpg` | neitiznot helm 62 / 41 / 13 px at 5.4 / 8.5 / 26; plain helm 95 / 61 / 20 px |
| mace 2,908 triangles, staff 2,856, a staff is 11 meshes | `Gear_mace-`, `Gear_staff-turnaround.jpg` | read from the file: mace 2,908 triangles in 23 mesh nodes, staff 2,856 in 13 mesh nodes (the design's 11 does not match `Gear_staff`; reported as found) |
| "a full ten-slot loadout is more than 60 draw calls" | not a picture claim | |

Play-distance heights of the other pieces, logged: scimitar 203 / 129 / 41, sword 184 / 112 / 31, greatsword 266 / 163 / 51, mace 239 / 149 / 47, staff 398 / 249 / 81, kiteshield 167 / 104 / 34, plate body 171 / 109 / 36, platelegs (one leg) 82 / 54 / 18, boots (one) 52 / 34 / 11 px.

**Rendered but not committed** (2 MB budget): the eleven `<piece>-silhouette.jpg` sheets, the play-distance sheets other than the two helms and the boot, and `Gear_boots_L-turnaround.jpg` (the boot keeps `Gear_boots_L-play-distance.jpg` and its place in `roster-silhouette.jpg`). The command above regenerates all of them.
