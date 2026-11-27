# SF3 Cave look: captures

Evidence for task SF3 (plan, "Slices 3 to 3b follow-ups"). The owner's H-3a check is still open.

## How the pictures were made

- **Tree:** `feat/content-systems` at `70d6ed2` (SF3's engine commit). The job was rerun with a better figure mask, and the committed pictures and `facts.json` come from that run.
- **Build:** BUILD ran through the capped wrapper.
- **Server:** `node_modules/.bin/vite preview --port 4397 --strictPort` served that build. The port was checked free first, and the server was stopped by its PID after the run.
- **Command:** `CAP_URL=http://localhost:4397/ CAP_OUT=docs/superpowers/baseline/s6/sf3 node scripts/capture-gpu.mjs docs/superpowers/baseline/s6/sf3/capture-job.mjs http://localhost:4397/`, exit 0.
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
- "Behind" is the frame without the monster, over the same pixels, which is mostly the cave floor.
- `cameraDistance` is the distance from the camera to the monster, on the ground plane.
- **D1:** the hero at the front hall's mouth (local 26.5, 34), every member idle at home.
- **D2:** 5 s after the hero steps to (30, 34). Both front demons are on him; the front Hurler stays idle about 21 from the camera.
- Each scene is measured three ways. Only `current` is the game; the other two are changes made in the page only:
  - `current`, as the game draws the Hurler;
  - `charcoal`, a charcoal tint `0x3a3530` multiplied in the same way as the tint is today;
  - `tintAsColour`, the amendment's proposal: `0xb8b2a7` as the colour of the body, horn and membrane, with vertex colours off.

**How the models draw** (`facts.materials`):
- Both models' body, horn and membrane meshes draw with vertex colours on, and the geometry has a `color` attribute.
- The material colour is `ffffff` on the Lesser Demon and `b8b2a7` on the Hurler.
- So the demons' red is in the vertex colours, and `blenderMonsters.ts` multiplies the tint into it.

**Front hall, the three nearest figures** (luminance is linear; contrast is against what is behind):

| Scene, mode | Lesser Demons: luminance, saturation | Ember Hurler: luminance, saturation, hue | Hurler contrast |
|---|---|---|---|
| D1 `current` | 0.0098, 0.0104; 0.95, 0.89 | 0.0032; 0.97; 2° | 1.30 |
| D1 `charcoal` | 0.0089, 0.0138; 0.88, 0.83 | 0.0027; 0.72; 5° | 1.31 |
| D1 `tintAsColour` | 0.0098, 0.0095; 0.95, 0.95 | 0.0564; 0.87; 9° | 1.94 |
| D2 `current` | 0.0124, 0.0157; 0.86, 0.87 | 0.0046; 0.97; 5° | 1.31 |
| D2 `charcoal` | 0.0120, 0.0148; 0.86, 0.81 | 0.0051; 0.68; 6° | 1.22 |
| D2 `tintAsColour` | 0.0123, 0.0130; 0.86, 0.87 | 0.0398; 0.83; 8° | 1.29 |

**What the table shows:**
- Today the Hurler is the same fully saturated red as the demons, about a third of their luminance: a darker demon.
- A charcoal multiply leaves it about as dark and still red (saturation 0.68 to 0.72).
- Tint-as-colour makes it 3 to 6 times brighter than the demons. It is still red-hued, because `CAVE_LIGHT`'s key and bounce are ember.

**A light retune, measured on a scratch build and not committed.** `look.ts` was edited, built, captured into the scratchpad, and then restored byte for byte and rebuilt:
- **Values:** `CAVE_LIGHT` key `#ffd0b0` at 0.9, fill `#2a2430`, bounce `#8a5a40`, exposure 1.4, and `CAVE_FOG_SCALE` 1.5.
- **`current` under that light:** the demons go brown (saturation 0.49 to 0.62), and the Hurler stays dark red (luminance 0.0064 to 0.0077, saturation 0.75 to 0.88).
- **`tintAsColour` under that light:** the Hurler measured luminance 0.0947 at D1 and 0.0521 at D2, saturation 0.64 to 0.65, hue 17° to 20°. That is a tan-grey that reads apart from the brown demons.
- So a light retune alone does not make the Hurler "ash-pale or charcoal, not red". The tint applied as a colour does, and a light retune can add to it.
## Findings

1. **Hurler tint:** not fixed. It needs `src/engine/blenderMonsters.ts` and probably a row field in `src/data/world.ts`, both outside SF3's files. Proposed in the plan's SF3 amendment.
2. **Footer after a death or a reload (not SF3's, and it was there before SF3):**
   - `finishRespawn` (`actions.ts`) sets the saved region to `lumbridge` through `applyRespawn` but never writes the footer.
   - So after a death the footer keeps the last region it named. Before SF3 that was the region outside the cave, and it still is.
   - This is G-6.3a's `g1` observation, for the same reason. A scratch run that died in the cave showed footer "Dragon's Peak Highlands" at Lumbridge.
