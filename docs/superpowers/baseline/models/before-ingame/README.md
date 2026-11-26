# In-engine "before" captures (V4)

Today's models in the game at noon on the balanced tier. Poses are in `../poses.json`; the main session took them on 2026-11-25 at commit 688f1a2 plus the guards pose change, on the GPU through `scripts/capture-gpu.mjs` (renderer: ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 4070 Laptop GPU), OpenGL 4.6)). The capture followed `docs/superpowers/baseline/stage5/capture.md` steps 1 to 7: seeded `Math.random`, onboarding dismissed, mouse parked on the HUD so no hover tile shows, skills raised to 99 so no camp attacks the hero, 2 s settle before each shot.

The guards pose looks down over the gate walls (pitch 0.7): at the plan's pitch 0.2 the walls hide both guards. One guard stands in the gap; the other is behind the east wall at this angle.

| Pose | Perf HUD (calls with shadow pass, triangles) | Screen draws per frame | Off-screen draws per frame |
|---|---|---|---|
| model-hero-close | 2178 calls • 675k tris | 1151 | 1023 |
| model-hero-play | 2088 calls • 663k tris | 1087 | 991 |
| model-guards | 1077 calls • 593k tris | 122 | 965 |
| model-camp-goblin | 1776 calls • 603k tris | 665 | 1150 |
| model-camp-dunes | 1137 calls • 377k tris | 326 | 781 |
| model-camp-pass | 609 calls • 435k tris | 247 | 411 |
| model-camp-dragon | 166 calls • 318k tris | 52 | 114 |
