# monsters.glb, before

Shipped `public/models/monsters.glb` (ten figures; Stage 4's Ashmantle is not in the file on this branch), rendered on Blender 5.0.1 by `scripts/blender/review_render.py` (command in `../README.md`), no options, exit 0, 125 s wall. Sheets in `monsters/`: per figure a turnaround and a play-distance sheet, and one roster silhouette at the 26 distance (left to right: chicken, dark ranger, dark wizard, dragon, goblin raider, goblin archer, hill giant, lesser demon, moss guardian, scorpion). Monsters have no clips in the file; their motion is code (`poseMonsterLimbs`) and is not rendered. Claims are design sections 1 and 4.2, quoted; no judgement is added (plan 0.3 rule 6).

| Figure | Design 4.2, "weakest point at play distance" | Px at 5.4 / 8.5 / 26, design | Measured |
|---|---|---|---|
| Chicken | "The best-reading figure today. Too many meshes for its size." | 178 / 113 / 37 | 171 / 103 / 32 |
| Goblin raider (`goblin`) | "Box torso, tube limbs with gaps, near-black green. Shield and spear carry the outline alone." | 343 / 218 / 71 | 323 / 209 / 70 |
| Goblin archer | "Same outline as the raider; the hood hides the one feature (the ears) that says 'goblin'." | 371 / 236 / 77 | 375 / 239 / 79 |
| King scorpion | "Good outline. Thin legs alias; 68 draw calls; one dark value." | about 540 / 345 / 113 | 608 / 379 / 123 |
| Dark wizard | "The hat reads; the robe is a cone with stripes; the staff merges with the body." | 560 / 355 / 116 | 574 / 362 / 117 |
| Dark ranger | "Reads as 'dark figure with stick'." | 500 / 317 / 104 | 500 / 316 / 104 |
| Hill giant | "Good mass. Joints are stacked balls; the club is lost in front of the belly." | 785 / 498 / 163 | 712 / 463 / 160 |
| Moss guardian | "Dark brown on dark green; the glowing core is the only thing that reads." | 919 / 583 / 191 | 952 / 584 / 185 |
| Lesser demon | "Body, head and arms are one mesh under the root; only the cleaver and wings move. T-pose arms; wings attached off-centre; realistic thin limbs beside doll-like neighbours." | 907 / 576 / 188 | 1019 / 600 / 186 |
| Dragon (`elvarg_dragon`) | "A statue. One flat dark green. 8,928 of its triangles (26%) are teeth nobody sees." | 772 / 490 / 160 (to the wing tips) | 796 / 566 / 161 |

Where to look: shape, joints and colour in `<figure>-turnaround.jpg`; what survives at play size in `<figure>-play-distance.jpg`; "the goblin raider and the goblin archer, and the dark ranger next to both, share one outline" (fact 2) in `roster-silhouette.jpg`. Fact 2b (the dragon's and the demon's pivots hold no mesh, so they do not move) is a claim about the file and the engine, not a picture: a render of the stored pose cannot show it.

Heights differ from the design's table by up to 16% (dragon at 8.5: 566 against 490; chicken at 26: 32 against 37; demon at 5.4: 1019 against 907; scorpion 608 against "about 540"; hill giant 712 against 785). The design's numbers are estimates from the GLB height times the builder's scale; the renderer measures the alpha mask at the camera's pitch, with the scale from `scripts/blender/review_scales.json`. Reported as measured, not reconciled.

**Clipped sheet.** In `elvarg_dragon-play-distance.jpg` the 5.4 crop is cut by the 1080-line frame: the wing tips leave the top and sides and the body leaves the bottom. The logged 796 px is a lower bound, not the figure's height. The 8.5 and 26 crops hold the whole figure. The demon's 5.4 crop (1019 of 1080 lines) holds the whole figure.

**Rendered but not committed** (2 MB budget): the ten per-figure `<figure>-silhouette.jpg` sheets (434 kB); the roster sheet holds every figure in silhouette at its 26-distance size. The command above regenerates them.
