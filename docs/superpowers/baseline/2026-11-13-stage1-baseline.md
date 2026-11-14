# Stage 1 baseline (commit a514508)

Captured 2026-11-13 before any Stage 1 code change.

## Gate
- SUITE: 11 test files, 103 tests passed.
- TYPES: `tsc --noEmit` exit 0, no output.
- BUILD: `dist/assets/index-*.js` 926.36 kB (gzip 250.64 kB), css 29.28 kB, html 18.03 kB.

Commands run through `scripts/capped.sh` (allowlisted environment, 3 GB memory cap).

## Save fixture
`tests/fixtures/save-v4.json`: written by the game's own `writeSave` in a browser, `version: 4`.
It was produced by automation, not by hand play: the two built-in cheats (skills +10 four times, 200k gp),
a slayer task requested, the first quest claimed (its three flags were set directly), three items deposited
in the bank, Protect from Melee active, Fire Bolt chosen with the fire staff equipped (set directly),
special energy below 100, player at (8, 10) in the start town.

## Rendering numbers
From the audit run (headless, software renderer): start pose 1509 draw calls / 226k triangles;
shrine pose 544 / 108k. Screenshots: `shot-03-noon.jpg`, `shot-04-peak.jpg`.

## Not captured
- FPS on the owner's GPU: not provided. The headless browser runs at about 3 FPS on a software renderer,
  so "FPS not lower than baseline" (G-2) can only be checked by the owner; draw calls and triangles are
  the proxy used otherwise.
- `renderer.info.memory.geometries` growth after 200 attacks: measured at G-2 against a fresh reading taken
  on this same commit at that time.
