# CP-4 "Do the shapes read?" (Stage 4)

Judged by the main session under the owner's standing rule "merge on green" (2026-11-14): the owner sees these
captures afterwards instead of blocking here. Headless browser, software renderer, all six attack shapes placed in a
ring around the hero with the fill half-way, camera at play distance looking down.

| File | Ground | Verdict |
|---|---|---|
| cw-01-grass.jpg | start-region grass, noon | Reads: red band clear, fill visible |
| cw-02-sand.jpg | dunes, noon | Outline reads, weakly; fill nearly lost (orange on orange) |
| cw-03-volcanic.jpg | volcanic corner, noon | **Does not read well**: red band on red-orange lava is faint, and this is where the pass sentries and the boss fight |
| cw-04-grass-night.jpg | grass, night set twice | Not conclusive: the software renderer showed the same image as day |

Also seen: a shape under a tree canopy is hidden by the canopy (cw-01, top centre).

**Result: does not pass.** As the plan allows, one fix task is added (T6, `telegraphs.ts` only): a dark halo band
outside the coloured band so the edge reads on any ground, a wider coloured band, and the outline and halo drawn
over foliage. Re-captured after T6 on the same three grounds.

## After T6 (2026-11-15)

Same poses, all eleven attack shapes (the six ordinary ones and the boss's five) placed in the ring at once, so they
overlap far more than in a fight.

| File | Ground | Verdict |
|---|---|---|
| cw-t6-01-grass.jpg | grass | Reads; the bands now draw over the tree canopies |
| cw-t6-02-sand.jpg | dunes | Reads: the dark halo carries the edge on sand |
| cw-t6-03-volcanic.jpg | volcanic | **Reads now**: red band with a dark edge stands out on lava |

**Result: CP-4 passes after T6.** Night remains unjudged here (the software renderer did not change the image); it is
on the owner's play list for Stage 4.
