# M0p: merge-only monsters, before and after

Same tree (6a225a5); "before" swaps back cc94d89's `public/models/monsters.glb` and its `?v=` key for one build. Headless Chromium on the NVIDIA GPU (`scripts/capture-gpu.mjs`, ANGLE over D3D12, RTX 4070 Laptop), 1280x720, balanced, noon, seeded `Math.random`, skills at 99. Colour = draw calls per frame to the canvas, shadow = to a render target, over 1 s; HUD = `#perf-calls`. Monsters wander, so a pose's counts move by a few percent between runs. Frame time is not measured here: it is read on the owner's machine (OM-S0b).

| pose | before colour | before shadow | before HUD | after colour | after shadow | after HUD |
|---|---|---|---|---|---|---|
| P1 noon (start pose) | 1197 | 985 | 2241 calls, 689k tris | 691 | 617 | 1307 calls, 677k tris |
| goblin camp | 637 | 1152 | 1794 calls, 605k tris | 357 | 684 | 1041 calls, 604k tris |
| hero close | 1157 | 1022 | 2162, 674k | 681 | 651 | 1346, 684k |
| hero play | 1148 | 936 | 2022, 654k | 702 | 649 | 1351, 695k |
| guards | 122 | 907 | 1029, 588k | 122 | 627 | 749, 595k |
| dunes camp | 390 | 787 | 1191, 386k | 157 | 381 | 545, 378k |
| pass camp | 248 | 359 | 608, 435k | 169 | 232 | 401, 435k |
| dragon | 53 | 114 | 171, 324k | 50 | 84 | 134, 318k |

## GR7 limits (moved here by the owner on 2026-11-24), P1 noon balanced

Against Stage 5's V2 capture (colour 1178, HUD 2170, 675k triangles):

| limit | after | result |
|---|---|---|
| colour calls at most 1000 | 691 | pass |
| colour calls at most 60% of V2 (706) | 691 (58.7%) | pass |
| calls with the shadow pass at most 60% of V2 (1302) | 1307 (60.2%) | **miss by 5 calls** |
| triangles at most 550k | 677k | **miss** (the merge moves no triangle) |

Both misses go to the Slice 8 budgets with these numbers, as M0p's amendment says. The shadow-pass miss is within the run-to-run spread of wandering monsters; the triangle miss is not the monsters' (their triangles are unchanged) and is for Slice 8 to place.

Pictures: `before-P1-noon.jpg`, `after-P1-noon.jpg`, `before-model-camp-goblin.jpg`, `after-model-camp-goblin.jpg`; all rows in `before-rows.json` and `after-rows.json`.
