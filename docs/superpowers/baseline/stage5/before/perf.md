# Before: calls and thousand triangles (calls/ktris), 1280x720 unless the pose says otherwise

Headless, software renderer. The count includes the shadow pass (V1b). Counts move with streamed chunks and animated monsters, so repeat captures differ by a few percent. Presets: golden 0, noon 1, night 2.

| pose | time | performance | balanced | high | ultra |
|---|---|---|---|---|---|
| P1 | golden | 1532/265 | 3184/589 | 3180/589 | 3161/586 |
| P1 | noon | 1479/258 | 3207/593 | 3293/607 | 3293/607 |
| P1 | night | 1489/259 | 3246/600 | 3262/603 | 3241/600 |
| P2 | golden | 1239/242 | 3178/606 | 3184/606 | 3182/606 |
| P2 | noon | 1225/240 | 3142/601 | 3136/600 | 3135/600 |
| P2 | night | 1196/237 | 3159/604 | 3176/607 | 3176/607 |
| P3 | golden | 342/201 | 1764/438 | 1764/438 | 1764/438 |
| P3 | noon | 342/201 | 1705/430 | 1705/430 | 1764/438 |
| P3 | night | 342/201 | 1764/438 | 1764/438 | 1764/438 |
| P4 | golden | 311/198 | 1273/373 | 1330/381 | 1347/382 |
| P4 | noon | 311/198 | 1273/373 | 1330/381 | 1350/392 |
| P4 | night | 311/198 | 1330/381 | 1345/382 | 1287/384 |
| P5 | golden | 156/120 | 488/257 | 492/266 | 492/266 |
| P5 | noon | 156/120 | 492/266 | 488/257 | 488/257 |
| P5 | night | 156/120 | 492/266 | 492/266 | 492/266 |
| P6 | golden | 436/108 | 2162/430 | 2162/430 | 2162/430 |
| P6 | noon | 436/108 | 2164/430 | 2164/430 | 2162/430 |
| P6 | night | 436/108 | 2162/430 | 2162/430 | 2162/430 |
| P7 | golden | 98/69 | 997/202 | 1058/213 | 1077/216 |
| P7 | noon | 169/80 | 1024/208 | 1004/205 | 995/203 |
| P7 | night | 183/82 | 1016/206 | 1016/206 | 1016/206 |
| P8 | golden | 405/205 | 2023/537 | 2040/540 | 2019/537 |
| P8 | noon | 405/205 | 2018/537 | 2026/538 | 2031/538 |
| P8 | night | 405/205 | 2018/536 | 2019/536 | 2019/536 |
| P9 | golden | 1013/205 | 2015/447 | 2014/447 | 2015/447 |
| P9 | noon | 1013/205 | 1999/445 | 1999/445 | 1999/445 |
| P9 | night | 1013/205 | 1999/445 | 1999/445 | 1999/445 |
| P10 | golden | 1546/295 | 3370/640 | 3370/640 | 3365/639 |
| P10 | noon | 1536/294 | 3384/643 | 3343/637 | 3320/640 |
| P10 | night | 1479/294 | 3363/645 | 3346/638 | 3346/638 |
| P11 | 1280x720 @1 noon, HUD on | 1499/261 | 3150/585 | 3139/583 | 3151/585 |
| P11 | 1920x1080 @1 noon, HUD on | 1530/265 | 3197/592 | 3180/589 | 3180/589 |
| P11 | 3840x2160 @1 noon, HUD on | 1532/265 | 3181/589 | 3180/589 | 3159/586 |
| P11 | 1920x1080 @2 noon, HUD on | 1499/261 | 3180/589 | 3160/586 | 3177/588 |

P4 and P5 golden performance were recaptured on a fresh load with the player's skills raised to 99 before the first pose, so no camp aggroes (`monsterThreatColor` is green) and the player stays alive at the pose. Every recaptured shot was checked after the screenshot: `player.downed` false, hp above 0, the player within 1 unit of the pose target, and no monster in chase or attack.

P11 is the HUD on, inventory tab open, the level-up banner shown and one hit splat over the player, at four sizes on every tier (`P11-<w>x<h>@<ratio>-<tier>.jpg`). The bank, shop, world map, quests and settings windows exclude each other, so each is its own picture per size, on balanced only, since windows do not change with the tier (`P11-<w>x<h>@<ratio>-<window>.jpg`). At ratio 2 the drawing buffer follows the tier's pixel-ratio cap: 1920x1080 on performance, 2400x1350 on balanced, 2880x1620 on high, 3840x2160 on ultra.
Pictures: `<pose>-<time>-<tier>.jpg` in this folder (P10 only at its base yaw).
