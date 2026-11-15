# guard.glb, before

Shipped `public/models/guard.glb`, rendered on Blender 5.0.1 by `scripts/blender/review_render.py` (command in `../README.md`), no options, exit 0, 12 s wall. Sheets in `guard/`. The claims are design sections 1 (fact 1) and 4.2, quoted; no judgement is added (plan 0.3 rule 6).

| Design says | Look at | Measured |
|---|---|---|
| "T-pose, sword pointing at the sky" (4.2) | `guard-turnaround.jpg` | Stored pose, no animation (the file has none) |
| "one grey, realistic proportions in a stylised game" (4.2) | `guard-turnaround.jpg`; beside the hero in `../hero/hero-turnaround.jpg` | |
| Pixels tall at 5.4 / 8.5 / 26: "400 / 250 / 82 (body)" (4.2) | `guard-play-distance.jpg` | 563 / 361 / 107 px. The renderer measures the whole figure from the alpha mask, sword included; the design's figure is the body alone, so the two are not the same measure |
| 53,598 triangles each, 27 meshes, 2 materials; 1,174,350 bytes on the wire, 31% of all model bytes, "the weakest asset per byte" (1, 4.1, 4.2) | not a picture claim; from the file | |

**Found by V2, to check here:** in all three views both gauntlets stand apart from the upper arms, with a visible gap at the elbow (`guard-turnaround.jpg`). The file has no skin, no animation and no node rotation or scale, and the renderer moves nothing, so the gap is in the shipped geometry (`../README.md`, note on the guard). Whether the game shows it is for the in-engine capture (V4).

Design 4.6: the guards are rebuilt from the hero body and armour, and `guard.glb` is deleted.

**Rendered but not committed** (2 MB budget): `guard-silhouette.jpg`; `roster-silhouette.jpg` holds the figure at its 26-distance size. The command above regenerates it.
