# Slice 3: gear merge (G6)

`public/models/gear.glb` promoted at `?v=8a3c0d1b` (SHA-256 8a3c0d1b...): the G2b merged build, rebuilt on Blender 5.0.1.
Raw 2,331,560 -> 1,870,908 bytes; Brotli q3 668,121 -> 512,031 (ceiling 690,000). COMPARE: Contract and Budget pass.

Sheets: `g6-{plate,bandos}-{idle,slash}.jpg` are in-engine captures on the GPU of the skinned hero (no page errors, `scratch/g6/cap/capture.json`). Plate set: rune_helm, rune_plate, rune_legs, rune_shield, rune_boots (feet), rune_gloves (hands), rune_scimitar. Bandos set: bandos_chest and bandos_tassets with bandos_godsword; the game has no bandos helm, so the head stays rune_helm, and shield, feet and hands stay rune_shield, rune_boots and rune_gloves.
Blender `--against` sheets: `gear-against/<root>-against.jpg`, left = pre-G6 `gear.glb` (c58d4ee, SHA-256 92e8eb78...), right = the merged `gear.glb`, for the eleven gear roots (the six shared silhouettes and five named pieces of V3). `scripts/blender/review_scales.json` has no `Gear_*` entries and is outside G6's file list, so, as V3 did (`before/gear.md`), the render used a scratch copy of `scripts/blender/` (`review_render.py` and `paths.py` unchanged, the scales table plus the eleven roots at 1.0): `blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python scratch/v3/tool/scripts/blender/review_render.py -- public/models/gear.glb <dir> --only <the eleven roots> --against <pre-G6 gear.glb>`, exit 0. Measured tile difference left vs right: identical (0) for boots, greatsword, kiteshield, plate body, platelegs, scimitar and sword; at most 4 of 255 for helm and neitiznot helm; mace and staff differ only because the two tiles are framed on different bounds (the figure sits shifted in the tile), the shapes read the same. The merge is a repack, so no silhouette change is expected, and none shows. Sheets total 336 kB.

Declared follow-through edits (as H7): `tests/model-cache-key.test.ts` (gear leaves LEGACY, so its key is checked against the shipped hash) and `tests/fixtures/model-contract/totals.json` (gear key; totals by the manifest rule: sum of the five files x 1.01).

## N3: guards built from the hero and gear

`CREDITS.md`: the knight's row moved from "Shipped in the game" to a new part, "Source removed; credit kept" (same words: Blend Swap 28541, Xali, CC0). `blender/examples/knight_28541/knight.blend` deleted (owner decision D-3); its `LICENSE.txt` stays with "Used by" updated. `tests/credits.test.ts` and `tests/model-licences.test.ts` pass untouched.

Captures `n3-gate-{play,front,top}-{before,after}.jpg`: the game on the GPU (ANGLE D3D12, NVIDIA GeForce RTX 4070 Laptop GPU), balanced tier, noon, seeded `Math.random`, skills at 99, HUD hidden then read, no page errors. Before = `e623625` (guard.glb still shipped); after = N3's head. Poses: `play` = the `model-guards` pose (x 0, z -15, yaw 3.142, pitch 0.7, distance 7); `front` = x 0, z -17.5, yaw 0, pitch 0.25, distance 6; `top` = x 0, z -16.5, yaw 3.142, pitch 1.1, distance 6.

| Pose | Perf HUD before | Perf HUD after |
|---|---|---|
| gate-play | 543 calls, 573k tris | 527 calls, 395k tris |
| gate-front | 1033 calls, 820k tris | 1036 calls, 640k tris |
| gate-top | 522 calls, 556k tris | 507 calls, 379k tris |

Draw calls are level to 16 lower; triangles fall by about 180k.

**Finding for the owner.** In none of the three views are the new guards visible: they stand at x = +-2.4, z = -16.5, the positions the plan keeps unchanged, and those points are inside the two gate-wall blocks, so only their boots show under the walls' lower edge. In the "before" shots one old knight shows in the gap beside the player: the old `guard.glb` carried an offset that put one guard outside the stone. If the guards should be seen, their positions have to move to the gap (outside N3's list); N3 does not change them.
