# SF3 Cave look: captures

Evidence for task SF3 (plan, "Slices 3 to 3b follow-ups"). The owner's H-3a check is still open.

## How the pictures were made

- **Tree:** `feat/content-systems` at `70d6ed2` (SF3's engine commit).
- **Build:** BUILD ran through the capped wrapper.
- **Server:** `node_modules/.bin/vite preview --port 4397 --strictPort` served that build. The port was checked free first, and the server was stopped by its PID after the run.
- **Command:** `CAP_URL=http://localhost:4397/ CAP_OUT=docs/superpowers/baseline/s6/sf3 node scripts/capture-gpu.mjs docs/superpowers/baseline/s6/sf3/capture-job.mjs http://localhost:4397/`, exit 0.
- **Renderer:** `ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 4070 Laptop GPU), OpenGL 4.6)`, at 1280x720 on the `balanced` tier.
- **Browser state:** one fresh context, with `Math.random` seeded as in G-6.3a.
- **Hero:** hitpoints were set to 990 through `__DEBUG.STATE` so no fight ends the run.
- **Entry:** the hero went in by clicking the overworld door's hover label ("Interact with Slagfall Terrace").
- **Exit:** the hero left through `__DEBUG.leaveZone()`, the function the exit door's command calls.
- **Errors:** none (`facts.pageErrors` is empty).

## Results

| Item | Before (G-6.3a, `24d37dd`) | After (`facts.json`) | Pictures |
|---|---|---|---|
| Fissures | 22 slabs centred on the wall lines, half outside the rooms (G-6.3a `a3`, `b5`) | 22 fissures. Every footprint corner, and 9 points on each footprint edge, lies inside a room and off every pillar (`c.everyPointInsideARoom`, `c.noPointOnAPillar`). The closest point to a wall line is 0.632 away | `c1`, `c2`, `c3` |
| Cave-mouth label | 2 "Slagfall Terrace" labels, the place's and the door's (G-6.3a finding 7) | 1 label element, shown, at 3.5 and at 10 south of the door (`a1.labels`, `a2.labels`). The door's hover label and its click still work (`door`) | `a1`, `a2` |
| Banner and footer inside | "Dragon's Peak Highlands" (G-6.3a finding 8) | Banner title "Slagfall Terrace" over "Dragon's Peak Highlands", footer "Slagfall Terrace". The saved region stays `wilderness`, the region outside (`b1`) | `b1` |
| After leaving | n/a | Banner and footer "Dragon's Peak Highlands", hero at the door (-84, 98), saved region `wilderness` (`e1`) | `e1` |
| Hurler's tint | Same dark red as the Lesser Demon (G-6.3a finding 5) | **Not changed by SF3.** See the measurement below and the plan's SF3 amendment | `d1`, `d2` |

### The fissure placement

The placement code is in `zones.ts`:
- Each fissure is placed every 8 units along a wall segment.
- It sits 1.4 into the room from the wall line, at scale 0.6, and is turned to face the room.
- It is skipped when a corner of its footprint would leave every room or touch a pillar. The footprint is world.glb's `World_lava_fissure` bounds: x from -1.85 to 1.92 and z from -1.12 to 1.28.

On this cave row the rule skips none, so there are still 22 fissures, 27 props in all. The 22 local positions are in `facts.c.fissures`.

### The Hurler against the cave light (scene D)

**Method.**
- The hero stands at the mouth of the front hall (local 26.5, 34). Every member is idle at home.
- For each monster, the job takes two frames, one with the monster drawn and one without it.
- The pixels inside its projected box that differ by at least 30 are its figure.
- "Behind" is the same pixels in the frame without it, which is mostly the cave floor.

**Current code (`d1`):**

| Figure | Pixels | Mean sRGB | Hue, saturation | Luminance | Contrast to what is behind |
|---|---|---|---|---|---|
| Lesser Demon (36, 34) | 9,876 | 57, 14, 7 | 8°, 0.88 | 0.0120 | 1.08 |
| Lesser Demon (36, 39) | 11,458 | 60, 13, 6 | 8°, 0.90 | 0.0126 | 1.01 |
| Ember Hurler (44, 34) | 3,404 | 52, 15, 8 | 10°, 0.85 | 0.0109 | 1.20 |

The front hall's Hurler has the demons' hue and saturation and 0.9 of their luminance, so it does not read apart.

**Why the named levers cannot fix it:**
- In the page, the Hurler's body, horn and membrane materials have colour `b8b2a7` and the demon's have `ffffff`, and both draw with vertex colours.
- The red is in the model's vertex colours. `blenderMonsters.ts` multiplies the tint into the material colour, so the tint can only darken the same red.
- A charcoal tint (`3a3530`) was tried in a scratch probe: it measured the same hue, and its contrast to the floor was 1.0 to 1.08.
- A change to `CAVE_LIGHT` lights both figures alike, so it cannot make one read apart from the other.

**The proposal, shown in the page only (`d2`).**
- The Hurler's body, horn and membrane take `0xb8b2a7` as their colour, with vertex colours off. Nothing in `src/` does this.
- With it, the front Hurler measures sRGB 113, 29, 14 and luminance 0.0442. That is 3.0 to 3.7 times the demons' 0.0120 to 0.0146, and its contrast to the floor is 1.52 against the demons' 1.07 to 1.19.
- Its hue stays red (9°), because `CAVE_LIGHT`'s key and bounce are ember-red: a grey surface comes out at saturation 0.88.
- So the Hurler reads apart by brightness. For "ash-pale, not red" in the owner's words, `CAVE_LIGHT` would also need the retune that C1 already declares for H-3a.

## Findings

1. **Hurler tint:** not fixed. It needs `src/engine/blenderMonsters.ts` and probably a row field in `src/data/world.ts`, both outside SF3's files. Proposed in the plan's SF3 amendment.
2. **Footer after a death or a reload (not SF3's, and it was there before SF3):**
   - `finishRespawn` (`actions.ts`) sets the saved region to `lumbridge` through `applyRespawn` but never writes the footer.
   - So after a death the footer keeps the last region it named. Before SF3 that was the region outside the cave, and it still is.
   - This is G-6.3a's `g1` observation, for the same reason. A scratch run that died in the cave showed footer "Dragon's Peak Highlands" at Lumbridge.
