# Stage 5 baseline (task V2)

Commit before the visual pass: main merged into `feat/visual-pass` at `daafe34`. "The V2 chunk", "the V2 capture" and "the V2 bench" in design section 10 mean the numbers below.

## Bundle (BUILD)

| file | size | gzip |
|---|---|---|
| `dist/index.html` | 19.24 kB | 5.56 kB |
| `dist/assets/index-CeeNSvV7.css` | 31.70 kB | 7.54 kB |
| `dist/assets/index-vFpwnBIg.js` | 992.73 kB | 276.11 kB |

## Draw calls and triangles

Headless capture (software renderer, 1280x720, seeded `Math.random`, procedure `stage5/capture.md`) of P1 to P10 at presets golden, noon and night on all four tiers, and P11 at three viewport sizes. Every number is in `stage5/before/perf.md`; the pictures are in `stage5/before/`.

Shadow pass: the count includes it since V1b. The performance tier has shadows off, so balanced minus performance is the shadow pass plus whatever else the tier changes. At P1 noon: performance 1479 calls, 258k tris; balanced 3207 calls, 593k tris; so the pass and the tier's other differences cost about 1730 calls and 335k tris. Counts vary by a few percent between runs (streamed chunks, animated monsters), and a few poses (P4 golden balanced 2723, P5 golden performance 507) caught a chunk mid-stream; treat the single numbers as approximate.

## Frame times (OV-2, owner)

Not measured: headless frame times are not valid. The owner runs `__DEBUG.look.bench(300)` at P1, P3, P5 and P8 on each tier and fills this table, and names the reference machine (QV5). Until then the budgets of design section 10 stay provisional.

Reference machine, GPU, display: ______

| pose | performance ms | balanced ms | high ms | ultra ms |
|---|---|---|---|---|
| P1 | | | | |
| P3 | | | | |
| P5 | | | | |
| P8 | | | | |
