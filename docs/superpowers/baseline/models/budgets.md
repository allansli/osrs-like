# Final budgets (task X2)

Ceilings in `tests/fixtures/model-contract/*.json` are set to design 9.1 and 9.2 with decision N-3 (the shipped `hero.glb` and `monsters.glb` are 8-bit packed). No GLB changed. Measured with `figureStats` and `readGlb` on `public/models/` at the head of `feat/models-pass`.

## Set

| Ceiling | Value | Measured |
|---|---|---|
| Total Brotli (`totals.json`) | 2,600,000 | 2,043,428 |
| `hero.glb` Brotli | 150,000 | 120,678 |
| `gear.glb` Brotli | 690,000 | 512,031 |
| `monsters.glb` Brotli | 1,270,000 | 920,877 |
| `world.glb` Brotli | 489,842 | 489,842 (equal, passes) |
| Hero body (`HeroRoot`) | 6,000 tri, 11 meshes, 11 materials, 150,000 Brotli | 5,216 / 11 / 11 / 81,167 |
| Chicken | 2,500 / 3 / 4 / 42,000 | 2,436 / 3 / 3 / 24,775 |
| Ordinary (goblin, archer, scorpion, wizard, ranger) | 5,000 / 4 / 5 / 80,000 | at most 4,576 / 4 / 4 / 71,695 |
| Large (giant, guardian, demon) | 7,000 / 4 / 5 / 110,000 | at most 5,558 / 4 / 4 / 92,886 |
| Dragon | 14,000 / 4 / 5 / 220,000 | 9,960 / 4 / 4 / 154,626 |
| Ashmantle | 12,000 / 4 / 5 / 190,000 | 9,560 / 4 / 4 / 157,369 |
| Kits | 1,200 / 2 / 3 / 20,000 | see misses |

Per-file triangles, meshes, materials and raw bytes, per-figure raw bytes, and `totals.rawBytes` have no design value and are unchanged.

## Misses (ceiling left at the design value, test red)

`tests/model-contract.test.ts` > `monsters.glb` fails Budget on two lines:

- `Kit_saltback_stalker`: meshes actual 4 > ceiling 2 (triangles 986, materials 2, Brotli 12,151 hold).
- `Kit_thornwatch_marksman`: meshes actual 3 > ceiling 2 (triangles 1,004, materials 1, Brotli 16,573 hold).

Design 9.1 gives a kit "2 rigid" meshes. Both kits are over by their mesh count only. For the owner: raise the kit mesh ceiling to 4 (design row edit), or merge the kits' meshes in the builder (a GLB change, outside X2).
