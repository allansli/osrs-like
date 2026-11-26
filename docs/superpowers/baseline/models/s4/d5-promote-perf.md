# D5: monsters.glb promoted (dragon, Ashmantle, demon), captures and perf

Promoted file: `public/models/monsters.glb`, SHA-256 `ad6a47b7...` (`?v=ad6a47b7`), 3,411,448 bytes (packed by Q1's step from 4,813,856 as exported), Brotli 822,441 (shipped before: 4,558,688 raw, 1,401,411 Brotli). Triangles 94,712 to 74,724; meshes 156; materials 44. COMPARE: Contract and Budget pass against the pending manifest, whose ceilings were set to the packed built values (per-file bytes plus 1%, per-figure Brotli plus 2%).

## Capture

Throw-away worktree of the promote commit (`95e6b5a`) with one uncommitted patch that exposes `__DEBUG.G` and `getTerrainHeight`; `vite build` and `vite preview`; headless Chromium on the NVIDIA GPU (`scripts/capture-gpu.mjs`, ANGLE over D3D12, RTX 4070 Laptop), 1280x720, balanced, noon, clear weather, seeded `Math.random`, skills at 99, the hero kept alive. Colour = draw calls per frame to the canvas, shadow = to a render target, over 1 s; HUD = `#perf-calls`. Monsters wander and the camera sits on steep ground in the lairs, so the lair rows move by a few calls between runs. Frame time is not measured here (OM-S4). All rows, monster states and every perf sample: `d5-promote-rows.json`.

| pose | colour | shadow | HUD |
|---|---|---|---|
| P1 noon (start pose) | 541 | 443 | 980 calls, 543k tris |
| goblin camp | 236 | 506 | 741 calls, 486k tris |
| dragon lair (-102, 92) | 47 | 65 | 112 calls, 239k tris |
| Ashmantle's arena (-102, 54) | 44 | 73 | 117 calls, 257k tris |
| the pass (demons at -42, 55) | 52 | 130 | 185 calls, 279k tris |

GR7 limits (M0p's amendment), P1 noon balanced, against Stage 5's V2 (colour 1178, HUD 2170, 675k): colour at most 1000 and 60% of V2 (706): **541, pass**; calls with the shadow pass at most 60% of V2 (1302): **980, pass**; triangles at most 550k: **543k, pass** (M0p missed the last two at 1307 and 677k; the rebuilt figures, the merged gear and the packed hero have closed them).

In every row the figures stand on the skinned path: the dragon and Ashmantle have 4 skinned meshes and the clips `Bite`, `Death`, `Idle`, `Walk`, `WingBuffet` (the dragon's library, Ashmantle through `body: 'ashmantle'`); the demon has 4 skinned meshes on the hero file's biped clips. No page error or console error in the run.

## Pictures

`d5-lairs.jpg`, 2 by 2: the dragon at its lair with the hero for scale; Ashmantle at its arena from the side; Ashmantle from the front (it was already moving toward the hero); a lesser demon in the pass with the hero beside it. Taken at the game's own cameras (the pass and Ashmantle's slope are steep, so the camera sits above the ground in some of them).

## Sheets cut

`s4/` was 1,905,974 bytes of JPEG before this capture. `d3-ashmantle-ingame.jpg` (152,093 bytes, Ashmantle at its arena on the staged build) leaves the tree: `d5-lairs.jpg` replaces it on the shipped file and `d2b-ashmantle-windup.jpg` keeps the wind-up and bite evidence. It stays in history at `95e6b5a^`. The numbers of that capture stay in `d3-ashmantle-ingame-rows.json`.
