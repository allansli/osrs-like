# Oil paint — credits

Vendored from [Oil paint](https://patch.gg/blendi/oil-paint) by @blendi (Patch), release **1.0.1**, commit `6a5b4f56769a6a6964b4aa7f3cc29c7cca5ba930`.

| | |
|---|---|
| Code | MIT. The licence notice is `src/oilpaint/LICENSE`. |
| What this directory is | Only `src/oilpaint/` — the painter (`dabs`, `brush`, `common`, `ground`, `pins`, `shade`, `finish`). Files are unchanged from that commit. |
| What was not copied | The autumn wood (`src/world/`), Rapier, and the demo stills. The game keeps its own scene, camera, and game loop. |
| three.js | The painter is built on three **0.186.1**, installed from npm (MIT). |
| Wanderer code | `src/figure/man.js`, `animator.js`, and `hands-anymove.json` are Patch's starter man, CC0 1.0. `cloak.js` and `figure.js` are MIT, written by Patch for the oil-paint demo. |
| `public/figure/starter-man.glb` | Patch's starter man: MPFB2 / MakeHuman system assets (body, `male_casualsuit06`, `shoes05`, `short01`), rigged by Patch onto the Universal Animation Library skeleton. CC0 1.0. About 1.3 MB. |
| `public/figure/starter-man-clips.glb` | Quaternius Universal Animation Library 1 and 2 (idle, walk, jog, strafes, turns, jumps) and Patch's anymove clips (run, sprint, starts, stops, tired idle). CC0 1.0. About 19 MB. |

Colour in these shaders is paint: it is written as it should look and is not tone-mapped.
