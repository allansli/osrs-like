# LT7 light: perf HUD per picture

Headless capture, software renderer (SwiftShader): calls and triangles are valid, frame times are not. 1280x720, seeded `Math.random`, mouse parked on `#top-left-hud`, skills at 99 from a fresh load (capture.md, aggressive ground). Every shot: player alive (hp 99) at the pose target.

| pose | time | tier | calls | triangles |
|---|---|---|---|---|
| P1 | noon | performance | 1511 | 262k |
| P1 | golden | performance | 1494 | 260k |
| P1 | night | performance | 1482 | 259k |
| P3 | golden | performance | 342 | 201k |
| P5 | noon | performance | 156 | 120k |
| P5 | night | performance | 156 | 120k |
| P1 | noon | balanced | 2805 | 586k |
| P1 | golden | balanced | 3495 | 673k |
| P1 | night | balanced | 2942 | 606k |
| P3 | golden | balanced | 1702 | 517k |
| P5 | noon | balanced | 394 | 284k |
| P5 | night | balanced | 394 | 284k |
| P1 | noon | high | 3192 | 650k |
| P1 | golden | high | 4054 | 808k |
| P1 | night | high | 3201 | 650k |
| P3 | golden | high | 2341 | 627k |
| P5 | noon | high | 465 | 315k |
| P5 | night | high | 461 | 306k |
| P1 | noon | ultra | 3836 | 754k |
| P1 | golden | ultra | 4362 | 847k |
| P1 | night | ultra | 3861 | 757k |
| P3 | golden | ultra | 2691 | 670k |
| P5 | noon | ultra | 631 | 329k |
| P5 | night | ultra | 653 | 333k |
