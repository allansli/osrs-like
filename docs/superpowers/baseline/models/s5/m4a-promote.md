# M4a: monsters.glb promoted (goblin archer, chicken, raider refinements)

Promoted `public/models/monsters.glb`, SHA-256 `1bdba310...` (`?v=1bdba310`), 3,054,848 bytes (packed by Q1's step from 4,429,720 as exported), Brotli 812,801 (before: 3,411,448 and 822,441). Triangles 74,724 to 70,200, meshes 156 to 120, materials 44 to 38. Built from `487ea41` with BLEND(monsters) on Blender 5.0.1; the packed build is byte-identical to M3a's. `blender/monsters.blend` promoted with it. COMPARE (inside the promote step): Contract and Budget pass against the pending manifest, which replaced the live one (`m4a-promote-compare.md`). Drift names only chicken, goblin (raider refinements) and goblin_archer nodes and meshes and the file totals: **zero Drift on the scorpion, wizard, ranger, giant, guardian, dragon, Ashmantle and demon**.

Follow-through (plan, M4a promote amendments): cache key, `totals.json` (raw 8,028,507, Brotli 1,954,706), the families fixture's chicken, goblin and goblin_archer entries, the painted-figures case, and `PENDING_ARCHER_CLIPS` moved onto the live archer row.

Gate: SUITE 1,433 passed, 32 skipped, 1 failed (the known red, "the two variant rows name their kits", until K3); TYPES and BUILD exit 0.

Capture: throw-away worktree of the promote commit, `__DEBUG.G` patch, NVIDIA RTX 4070 Laptop, balanced, noon, clear, no page or console error. `m4a-promoted-ingame.jpg` (archer front, side, mid-`Ranged`, back, 8.5, 26; raider; chicken front, 8.5), `m4a-promoted-camp-yard.jpg`, rows and perf in `m4a-promote-rows.json`. Draw calls (colour / HUD): P1 noon about 500 / 880 calls, 540k tris (D5: 541 / 980, 543k); Three Kettle Camp about 200 / 613 (M3a: 619 to 629); hen yard 265 / 587. Archers: 2 skinned meshes, painted, `FACET_CUT`, one skeleton, animator over the hero's eleven clips, `Ranged` plays on `attackAnim`. Chickens: 3 skinned meshes, no animator, wings flap on `LWing`/`RWing`. `m4a-roster-silhouette.jpg`: the whole file told apart (GM6).

Owner at OM-S5: whether the archer's hood reads as a hood; the chicken's wings hinge at their roots (s5/README "Open").
