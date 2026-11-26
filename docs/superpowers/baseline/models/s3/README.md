# Slice 3: gear merge (G6)

`public/models/gear.glb` promoted at `?v=8a3c0d1b` (SHA-256 8a3c0d1b...): the G2b merged build, rebuilt on Blender 5.0.1.
Raw 2,331,560 -> 1,870,908 bytes; Brotli q3 668,121 -> 512,031 (ceiling 690,000). COMPARE: Contract and Budget pass.

Sheets: `g6-{plate,bandos}-{idle,slash}.jpg` are in-engine captures on the GPU of the skinned hero (no page errors, `scratch/g6/cap/capture.json`). Plate set: rune_helm, rune_plate, rune_legs, rune_shield, rune_boots (feet), rune_gloves (hands), rune_scimitar. Bandos set: bandos_chest and bandos_tassets with bandos_godsword; the game has no bandos helm, so the head stays rune_helm, and shield, feet and hands stay rune_shield, rune_boots and rune_gloves.
Not rendered: the Blender `--against` sheets of the gear roots, because `scripts/blender/review_scales.json` has no `Gear_*` scale entries and is outside G6's file list.

Declared follow-through edits (as H7): `tests/model-cache-key.test.ts` (gear leaves LEGACY, so its key is checked against the shipped hash) and `tests/fixtures/model-contract/totals.json` (gear key; totals by the manifest rule: sum of the five files x 1.01).
