# hero.glb, before

Shipped `public/models/hero.glb`, rendered on Blender 5.0.1 by `scripts/blender/review_render.py` (command in `../README.md`) with `--clips --engine-palette`, exit 0, 20 s wall. Sheets in `hero/`. The claims below are design section 4.2, quoted; the sheet named beside each is where to check it. No judgement is added here (plan 0.3 rule 6).

| Design 4.2 says | Look at | Measured by the renderer |
|---|---|---|
| "Seams open at knee and elbow (visible as a light band at the knees)" | `hero-turnaround.jpg` (front three-quarter, side, back three-quarter) | |
| "The face is faint" | `hero-turnaround.jpg`, `hero-play-distance.jpg` (5.4 crop) | |
| Pixels tall at 5.4 / 8.5 / 26: 410 / 260 / 85 | `hero-play-distance.jpg` | 405 / 254 / 82 px; turnaround tile 409 px |
| "Attack clips are sound (`Slash`: arm 1.84 rad with a wind-back, torso 0.90 rad)" | `hero-Slash-strip.jpg` | `RightArmPivot` 1.84, `Torso` 0.90, `HeadGroup` 0.45 rad |
| "`Idle` 0.02 to 0.06 rad on every pivot" | `hero-Idle-strip.jpg` | 0.02 to 0.06 rad (largest: both elbows 0.06) |
| "`Fish` 0.10 rad" | `hero-Fish-strip.jpg` | both arms 0.10, `Torso` 0.03 rad |
| "torso in `Walk` 0.04 rad" | `hero-Walk-strip.jpg` | `Torso` 0.04; legs 1.10, knees 0.75 rad |
| "torso in `Lunge` 0.24 rad" | `hero-Lunge-strip.jpg` | `Torso` 0.24; `RightArmPivot` 1.06 rad |

Every measured value matches the design's within its rounding; no mismatch.

The strips view the figure from the front (glTF +Z), so a stride reads as feet lifting in turn (see `../README.md`, note on the `Walk` strip).

**Rendered but not committed** (2 MB budget for `before/`): `hero-silhouette.jpg` (the roster sheet `roster-silhouette.jpg` holds the same figure at its 26-distance size) and the strips of the five clips section 4 does not cite: `Cast`, `Chop`, `Mine`, `Ranged`, `SpinSlash`. Their logged ranges: `Cast` arms 1.35, `Chop` right arm 2.84 and torso 0.44, `Mine` right arm 2.53 and torso 0.49, `Ranged` torso 0.55, `SpinSlash` torso 3.14 rad. The command above regenerates every one of them.
