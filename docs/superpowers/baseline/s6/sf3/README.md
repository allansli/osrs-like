# SF3 Cave look: captures

Evidence for task SF3 (plan, "Slices 3 to 3b follow-ups"). The owner's H-3a check is still open.

**Status (2026-11-27, second repair):** these captures were remade for `679d9f9`, the tree after the repair took the
`worldBuild.ts` guard back out and gave the Hurler its ash look in `zones.ts`. They supersede the first run (made on
`70d6ed2`, with the guard in and the Hurler unchanged). This directory is listed in the plan's SF3 amendment, which still
waits for the main session to ratify it.

## How the pictures were made

- **Tree:** `feat/content-systems` at `679d9f9` (`src/` as SF3's repair left it; `facts.srcCommit`). The next commit, `c5b8840`, changes only a comment in `zones.ts`; both trees build the same chunk, `index-BGQh9qWd.js`.
- **Build:** BUILD ran through the capped wrapper.
- **Server:** `node_modules/.bin/vite preview --port 4397 --strictPort` served that build. The port was checked free first, and the server was stopped by its PID after the run.
- **Command:** `CAP_SRC=679d9f9 CAP_URL=http://localhost:4397/ CAP_OUT=docs/superpowers/baseline/s6/sf3 node scripts/capture-gpu.mjs docs/superpowers/baseline/s6/sf3/capture-job.mjs http://localhost:4397/`, exit 0.
- **Renderer:** `ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 4070 Laptop GPU), OpenGL 4.6)`, at 1280x720 on the `balanced` tier.
- **Browser state:** one fresh context, with `Math.random` seeded as in G-6.3a.
- **Hero:** hitpoints were set to 990 through `__DEBUG.STATE` so no fight ends the run.
- **The target panel:** in `e1` it still names a Lesser Demon after leaving. That is SF5's item, not SF3's.
- **Entry:** the hero went in by clicking the overworld door's hover label ("Interact with Slagfall Terrace").
- **Exit:** the hero left through `__DEBUG.leaveZone()`, the function the exit door's command calls.
- **Errors:** none (`facts.pageErrors` is empty).

## Results

| Item | Before (G-6.3a, `24d37dd`) | After (`facts.json`) | Pictures |
|---|---|---|---|
| Fissures | 22 slabs centred on the wall lines, half outside the rooms (G-6.3a `a3`, `b5`) | 22 fissures. Every footprint corner, and 9 points on each footprint edge, lies inside a room and off every pillar (`c.everyPointInsideARoom`, `c.noPointOnAPillar`). The closest point to a wall line is 0.63 away | `c1`, `c2`, `c3` |
| Cave-mouth label | 2 "Slagfall Terrace" labels, the place's and the door's (G-6.3a finding 7) | 1 label element, shown, at 3.5 and at 10 south of the door (`a1.labels`, `a2.labels`). The door's hover label and its click still work (`door`) | `a1`, `a2` |
| Banner and footer inside | "Dragon's Peak Highlands" (G-6.3a finding 8) | Banner title "Slagfall Terrace" over "Dragon's Peak Highlands", footer "Slagfall Terrace". The saved region stays `wilderness`, the region outside (`b1`) | `b1` |
| After leaving | n/a | Banner and footer "Dragon's Peak Highlands", hero at the door (-84, 98), saved region `wilderness` (`e1`) | `e1` |
| Hurler's tint | Same dark red as the Lesser Demon (G-6.3a finding 5) | **Not changed by SF3.** See the measurement below and the plan's SF3 amendment | `d1-*`, `d2-*` |

## Results

| Item | Before (G-6.3a, `24d37dd`) | Now (`facts.json`) | Pictures |
|---|---|---|---|
| Fissures | 22 slabs centred on the wall lines, half outside the rooms (G-6.3a `a3`, `b5`) | 22 fissures. Every footprint corner, and 9 points on each footprint edge, lies inside a room and off every pillar (`c.everyPointInsideARoom`, `c.noPointOnAPillar`). The closest point to a wall line is 0.63 away | `c1`, `c2`, `c3` |
| Cave-mouth label | 2 "Slagfall Terrace" labels, the place's and the door's (G-6.3a finding 7) | **Still 2 label elements, both shown,** at 3.5 and at 10 south of the door and after leaving (`a1.labels`, `a2.labels`, `e1.labels`). In `a1` the upper one sits behind the region banner. The fix is the `worldBuild.ts` guard, which waits for ratification (finding 1) | `a1`, `a2` |
| Banner and footer inside | "Dragon's Peak Highlands" (G-6.3a finding 8) | Banner title "Slagfall Terrace" over "Dragon's Peak Highlands", footer "Slagfall Terrace". The saved region stays `wilderness`, the region outside (`b1`) | `b1` |
| After leaving | n/a | Banner and footer "Dragon's Peak Highlands", hero at the door (-84, 98), saved region `wilderness` (`e1`) | `e1` |
| Hurler's look | Same dark red as the Lesser Demon (G-6.3a finding 5) | Ash-pale: at the front hall's mouth saturation 0.26, hue 18°, contrast to the cave floor 2.10, against the demons' 0.85 to 0.91 and 2° to 5° (scene D below) | `d1-*`, `d2-*` |

### The fissure placement

The placement code is in `zones.ts`:
- Each fissure is placed every 8 units along a wall segment.
- It sits 1.4 into the room from the wall line, at scale 0.6, and is turned to face the room.
- It is skipped when a corner of its footprint would leave every room or touch a pillar. The footprint is world.glb's `World_lava_fissure` bounds: x from -1.85 to 1.92 and z from -1.12 to 1.28.

The job checks the placement independently of that constant:
- It reads each fissure's world box with `Box3.setFromObject`. That box is exact here, because every wall is axis-aligned and every fissure is turned by a multiple of 90°.
- It tests the box's corners and 9 points on each of its edges.

On this cave row the rule skips none, so there are still 22 fissures, 27 props in all. Positions and boxes are in `facts.c.fissures`.

### The Hurler against the cave light (scene D)

**Method.**
- A figure's pixels are its silhouette: the frame with every drawn mesh of that monster in flat magenta, with no light, fog or vertex colour.
- Its colour is the normal frame averaged over those pixels.
- "Behind" is the frame without the monster, over the same pixels: the cave floor (and, for the far figures, the hall's back wall). `contrastToBehind` is the WCAG ratio of the two linear luminances, so it is the contrast to the floor.
- `cameraDistance` is the distance from the camera to the monster, on the ground plane.
- **D1:** the hero at the front hall's mouth (local 26.5, 34), every member idle at home.
- **D2:** 5 s after the hero steps to (30, 34). Both front demons are on him; the front Hurler stays idle about 20 from the camera.
- Each scene is measured two ways:
  - `current`, as the game draws the Hurler (`zones.ts`'s `ashHurler`);
  - `old`, set in the page only: the Lesser Demon's material on the same meshes with the row's tint `0xb8b2a7` multiplied in, which is how `blenderMonsters.ts` drew the Hurler before `ashHurler`.
- The two modes are a few seconds apart, so idle members stand a little differently and the pixel counts differ.

**How the models draw** (`facts.materials`, the game as it is):
- The Lesser Demon's body, horn and membrane: colour `ffffff`, emissive `000000`, vertex colours on. Its red is in the vertex colours.
- The Ember Hurler's (it shares the model, so the meshes are `lesser_demon_*`): colour `3a3530`, emissive `b8b2a7` at 0.2, vertex colours off. That is `HURLER_ASH` in `zones.ts`.

**Every figure with pixels** (luminance is linear; "floor" is the luminance behind the figure):

| Scene, mode | Figure, distance, pixels | Luminance | Saturation | Hue | Floor | Contrast to floor |
|---|---|---|---|---|---|---|
| D1 `current` | Lesser Demon, 17.4, 23749 | 0.0138 | 0.91 | 5° | 0.0071 | 1.12 |
| D1 `current` | Lesser Demon, 19.1, 15271 | 0.0077 | 0.89 | 3° | 0.0050 | 1.05 |
| D1 `current` | **Ember Hurler (front), 26.7, 5169** | **0.0946** | **0.26** | **18°** | 0.0190 | **2.10** |
| D1 `current` | Lesser Demon (back), 48.0, 2316 | 0.0122 | 0.85 | 2° | 0.0066 | 1.10 |
| D1 `current` | Ember Hurler (back), 52.9, 690 | 0.0916 | 0.27 | 22° | 0.0018 | 2.73 |
| D1 `current` | Ember Hurler (back), 55.6, 19 | 0.0853 | 0.26 | 19° | 0.0017 | 2.62 |
| D1 `old` | Lesser Demon, 14.2, 29904 | 0.0134 | 0.91 | 5° | 0.0150 | 1.02 |
| D1 `old` | Lesser Demon, 19.8, 16037 | 0.0127 | 0.87 | 6° | 0.0076 | 1.09 |
| D1 `old` | Ember Hurler (front), 26.1, 5987 | 0.0070 | 0.86 | 5° | 0.0198 | 1.23 |
| D1 `old` | Lesser Demon (back), 45.0, 2577 | 0.0142 | 0.91 | 4° | 0.0023 | 1.23 |
| D1 `old` | Ember Hurler (back), 58.1, 945 | 0.0037 | 0.97 | 4° | 0.0023 | 1.03 |
| D2 `current` | Lesser Demon, 11.2, 30863 | 0.0149 | 0.86 | 6° | 0.0132 | 1.03 |
| D2 `current` | Lesser Demon, 9.2, 46837 | 0.0118 | 0.88 | 6° | 0.0170 | 1.09 |
| D2 `current` | Ember Hurler (front), 20.0, 9 | 0.1069 | 0.19 | 25° | 0.0221 | 2.18 |
| D2 `old` | Lesser Demon, 11.2, 31526 | 0.0145 | 0.88 | 8° | 0.0132 | 1.02 |
| D2 `old` | Lesser Demon, 9.2, 46452 | 0.0104 | 0.89 | 5° | 0.0186 | 1.14 |
| D2 `old` | Ember Hurler (front), 18.0, 734 | 0.0272 | 0.84 | 22° | 0.0222 | 1.07 |

**What the table shows:**
- As the game draws it, every Hurler measures saturation 0.19 to 0.27 at hue 18° to 25°, luminance 0.085 to 0.107, and contrast to the floor 2.10 to 2.73. The demons measure saturation 0.85 to 0.91 at hue 2° to 6°, luminance 0.008 to 0.015, and contrast 1.03 to 1.12. The Hurler reads as an ash-pale figure, brighter than the floor; the demons read as red, close to the floor.
- With the old look the Hurler measured saturation 0.84 to 0.97 at hue 4° to 22° and contrast 1.03 to 1.23: a darker red demon, as G-6.3a found.
- At fight range (D2) the two demons on the hero cover the front Hurler: 9 of its pixels show in `current`, 734 in `old`. D2's `current` row is thin evidence; D1's front Hurler (5169 pixels) is the measurement that counts.
- `CAVE_LIGHT` and the cave fog are unchanged (`src/data/look.ts`); the first run's scratch light retune is no longer part of SF3 and is not repeated.

## Findings

1. **Cave-mouth label:** not fixed on this tree. The guard is two lines in `buildDungeonDoors` (`src/engine/worldBuild.ts`), first committed in `70d6ed2` and taken back out in `a80302a`, because `worldBuild.ts` is outside SF3's files. With the guard in, the first run measured 1 label element at `a1` and `a2`. It goes back in when the main session ratifies the plan's SF3 amendment.
2. **Footer after a death or a reload (not SF3's, and it was there before SF3):**
   - `finishRespawn` (`actions.ts`) sets the saved region to `lumbridge` through `applyRespawn` but never writes the footer.
   - So after a death the footer keeps the last region it named. Before SF3 that was the region outside the cave, and it still is.
   - This is G-6.3a's `g1` observation, for the same reason. A scratch run that died in the cave showed footer "Dragon's Peak Highlands" at Lumbridge.
