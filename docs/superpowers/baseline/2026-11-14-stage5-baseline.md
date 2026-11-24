# Stage 5 baseline (task V2)

Commit before the visual pass: main merged into `feat/visual-pass` at `daafe34`. "The V2 chunk", "the V2 capture" and "the V2 bench" in design section 10 mean the numbers below.

## Bundle (BUILD)

| file | size | gzip |
|---|---|---|
| `dist/index.html` | 19.24 kB | 5.56 kB |
| `dist/assets/index-CeeNSvV7.css` | 31.70 kB | 7.54 kB |
| `dist/assets/index-vFpwnBIg.js` | 992.73 kB | 276.11 kB |

## Draw calls and triangles

Headless capture (software renderer, 1280x720, seeded `Math.random`, procedure `stage5/capture.md`) of P1 to P10 at presets golden, noon and night on all four tiers, and P11 at its four sizes (1280x720, 1920x1080 and 3840x2160 at ratio 1, 1920x1080 at ratio 2) with the HUD on. Every number is in `stage5/before/perf.md`; the pictures are in `stage5/before/`.

Shadow pass: the count includes it since V1b. The performance tier has shadows off, so balanced minus performance is the shadow pass plus whatever else the tier changes. At P1 noon: performance 1479 calls, 258k tris; balanced 3207 calls, 593k tris; so the pass and the tier's other differences cost about 1730 calls and 335k tris. Counts vary by a few percent between runs (streamed chunks, animated monsters).

**Repair of the first capture.** The first P4 run and P5 golden performance were wrong, not approximate: the Cinderstep Pass demons and the wilderness camp aggroed on the level-3 player, who died during the run, so those pictures showed the death screen, a demon over the camera, or the player respawned in Lumbridge, and their numbers (for example 311/198, 432/214, 2723/482 and 507/225) counted that instead of the pose. All twelve P4 pictures and P5 golden performance were recaptured on a fresh load (`localStorage` cleared in the init script) with `__DEBUG.STATE.skills` raised to 99 before the first pose, so the threat colour is green and no camp aggroes; each shot was checked for a live player within 1 unit of the pose target and no monster in chase or attack. Later slices must use the same step for P4 and P5 (the procedure `stage5/capture.md` is outside V2's files; the main session adds it). P5 at yaw 0 frames the wilderness obelisk in front of the player on every time and tier; that is the pose, not a capture fault.

**P11.** HUD on, inventory tab open, the level-up banner and one hit splat, at the four sizes on every tier, plus the bank, shop, world map, quests and settings windows one per picture at each size on balanced (the windows are DOM and do not change with the tier). The banner and the splat are not on `window`, so the capture writes the same DOM the game's `showLevelUpBanner` and `spawnHitSplatWorld` write (banner kicker and text plus class `show`; a `div.hitsplat.hit > span.hitsplat-num` at the player's projected head, its animation paused at 0.5 s). P11 starts from a fresh save with unmodified skills. Ratio 2 was captured in a Playwright context with `deviceScaleFactor: 2` (`devicePixelRatio` confirmed 2, pictures 3840x2160).

## Frame times (OV-2, owner)

Not measured: headless frame times are not valid. The owner runs `__DEBUG.look.bench(300)` at P1, P3, P5 and P8 on each tier and fills this table, and names the reference machine (QV5). Until then the budgets of design section 10 stay provisional.

Reference machine, GPU, display: ______

| pose | performance ms | balanced ms | high ms | ultra ms |
|---|---|---|---|---|
| P1 | | | | |
| P3 | | | | |
| P5 | | | | |
| P8 | | | | |
