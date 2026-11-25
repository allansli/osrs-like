# LT7b light: perf HUD per picture

Renderer: headless Chromium on the NVIDIA GPU (`scripts/capture-gpu.mjs`, ANGLE over D3D12, RTX 4070 Laptop), bundle `index-B6-RUjqm.js`. Every picture in this folder comes from this renderer (the LT7 set was SwiftShader; the LT7 bundle re-captured on this GPU gave the same ground and prop patch values to within 0.1 (the P5 night sky top differs by 4), so the before/after columns of `values.md` compare). Frame times are still not recorded: they come only from `look.bench` on the owner's machine (OV-2). 1280x720, seeded `Math.random`, cleared storage, mouse parked on `#top-left-hud`, skills at 99 from a fresh load (capture.md, aggressive ground). Every shot: player alive (hp 99, read after the shot); the position was not logged, and every picture was checked by eye for the pose (hero and scene where the LT7 picture has them).

| pose | time | tier | calls | triangles |
|---|---|---|---|---|
| P1 | noon | performance | 1502 | 262k |
| P1 | golden | performance | 1482 | 259k |
| P1 | night | performance | 1539 | 268k |
| P3 | golden | performance | 342 | 201k |
| P5 | noon | performance | 156 | 120k |
| P5 | night | performance | 152 | 110k |
| P1 | noon | balanced | 2837 | 598k |
| P1 | golden | balanced | 3442 | 665k |
| P1 | night | balanced | 2866 | 595k |
| P3 | golden | balanced | 1769 | 531k |
| P5 | noon | balanced | 390 | 275k |
| P5 | night | balanced | 398 | 294k |
| P1 | noon | high | 3236 | 657k |
| P1 | golden | high | 4083 | 814k |
| P1 | night | high | 3180 | 647k |
| P3 | golden | high | 2386 | 634k |
| P5 | noon | high | 465 | 315k |
| P5 | night | high | 465 | 315k |
| P1 | noon | ultra | 3940 | 770k |
| P1 | golden | ultra | 4373 | 849k |
| P1 | night | ultra | 3759 | 743k |
| P3 | golden | ultra | 2691 | 670k |
| P5 | noon | ultra | 634 | 331k |
| P5 | night | ultra | 682 | 336k |
| P12 (after f29, running clock) | noon | balanced | 2720 | 568k |
