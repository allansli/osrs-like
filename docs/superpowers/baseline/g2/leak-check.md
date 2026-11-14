# G-2 leak check (findings 11, 16, 17, 26), automated

Headless browser, software renderer, dev server. The hero stands next to one monster whose HP is refilled.
Warm-up first (20 attacks, 2 level-up fireworks, 4 weapon swaps, 45 s idle), then the reading "before";
then 200 attacks, 5 fireworks, 20 weapon swaps, 45 s idle, then the reading "after".
The number is `renderer.info.memory.geometries`.

| Build | Before | After | Growth |
|---|---|---|---|
| Without the fixes (feat/world-foundation at 63b85a3, spine and helper only) | 661 | 1362 | +701 |
| With the fixes (wf/integration at 9453a8c) | 2070 | 2072 | +2 |

Textures did not grow in either run (21 to 21, 23 to 23). VFX and projectile lists were empty at both readings.

Limits: the two runs started from different saved positions (a Lesser Demon and a Plump Chicken), so the
absolute counts differ; only the growth is comparable. The +2 was not traced. Level-ups were triggered by
calling the fireworks function directly, not by gaining levels. A first attempt that teleported the hero
between monsters was discarded: newly seen scenery uploads geometry and inflates the count.
Still for the owner: FPS on a real GPU.
