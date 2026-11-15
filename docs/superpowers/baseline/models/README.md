# Model review sheets

Sheets are offline renders of a GLB, built or shipped, made by `scripts/blender/review_render.py` (task V1) so a model can be looked at without the game. They are evidence for the owner, not the acceptance: the owner's look on a real GPU accepts every slice (design 7.3).

## How sheets are made

The renderer imports one GLB into a factory-startup Blender, renders with Cycles on the CPU (24 samples, one sun and one fill, grey world, transparent film), and writes JPEG sheets (quality 88) into the output directory. Cameras face the figure's front (glTF +Z). Figures are laid out by the renderer, one per tile, never by their place in the file. It prints one line per sheet: path, seconds, measured pixel height (from the alpha mask).

Exact command, from the worktree root (plan 0.2, SHEETS), one Blender process at a time:

```
systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 \
  timeout 600 /usr/bin/blender --background --factory-startup --disable-autoexec \
  --python-exit-code 1 --python scripts/blender/review_render.py -- <glb> <out dir> \
  [--only a,b] [--against <other.glb>] [--clips] [--worst] [--engine-palette]
```

or `scripts/capped.sh timeout 600 /usr/bin/blender ...` with the same arguments. Write `<out dir>` under `scratch/` and copy the sheets you keep into `docs/superpowers/baseline/models/<slice>/` (at most 2 MB per slice). The renderer only reads the GLB; it never writes beside it.

| Option | Effect |
|---|---|
| `--only a,b` | Render only these figures (root name or model key) |
| `--clips` | One six-frame strip per clip, with each pivot's or bone's rotation range printed to the log. Every object's active action is cleared before one NLA track is unmuted (critique C2) |
| `--worst` | Worst-pose sheet for a figure with an armature: deep crouch, arm overhead, full twist, head turned |
| `--against <glb>` | The same figure from another file side by side, same camera (before and after) |
| `--engine-palette` | Colours the hero by `extras.part` with the colours `blenderHero.ts` sets, as the engine does. Use it for every hero sheet |

Sheets per figure: turnaround (front three-quarter, side, back three-quarter, 512 px), silhouette (same views, flat black on white), play distance (crops of a 1080-line frame at distances 5.4, 8.5 and 26, in-game scale from `scripts/blender/review_scales.json`, pixel height drawn in the corner), one strip per clip with `--clips`, worst pose with `--worst`, and side by side with `--against`. One roster silhouette sheet holds every figure of the file at its 26-distance size.

## What a render proves and does not (design 7.3)

| Sheet | Content | Proves |
|---|---|---|
| Turnaround | Front three-quarter, side, back three-quarter, 512 px | Form, proportion, joints |
| Silhouette | The same three views in flat black on white | The 85 px read; species told apart on one roster sheet |
| Play distance | Crops of a 1080-line frame at distances 5.4, 8.5 and 26, at in-game scale, with the pixel height printed | What survives at play size |
| Motion | Six frames per clip in a strip (hero), or the pose table's poses (monsters); per clip, the measured rotation range of each bone. Worst-pose sheet per skinned figure | Anticipation, strike, follow-through; how the skin bends, pinches or tears in the worst pose |
| Before and after | The shipped and the built figure side by side, same camera | The change |

**A render can prove**: silhouette, proportion, relative size, pixel size at distance, joint gaps, pose and motion arcs, triangle density.

**A render cannot prove**: colour and material as the game draws them (the engine replaces every material and re-projects UVs), the banded light, the outline, shadows on the world, speed, the blend between clips, how a hit feels. Those need the in-engine capture (task V4), and that capture comes from a software renderer, so **the owner's look on a real GPU is the acceptance of every slice**.

## Honesty check (task V2, 2026-11-15)

Sheets rendered at commit `6a47eb1` on Blender 5.0.1 from the shipped files, into `scratch/v2/` (not committed; V3 commits the baseline):

- `public/models/hero.glb` with `--clips --engine-palette`: exit 0, 22 s wall, 14 sheets, each 2 to 46 kB.
- `public/models/guard.glb`: exit 0, 13 s wall, 4 sheets, each 3 to 35 kB.

| Known fact | Expected | Measured | Result |
|---|---|---|---|
| Hero height, turnaround tile | 410 px within 5% | 409 px | pass |
| Hero heights, play distance 5.4 / 8.5 / 26 | 410 / 260 / 85 px within 5% | 405 / 254 / 82 px (-1.2%, -2.3%, -3.5%) | pass |
| Guard shows its stored pose | T-pose, sword at the sky, no animation (design 4.2) | Arms out and angled down, sword raised over the right shoulder, same pose as the design's earlier renders (`today-people.jpg`) | pass (see note) |
| `Walk` strip | Legs alternate | Frames 2 and 5 lift opposite feet; log: `LeftLegPivot` and `RightLegPivot` 1.10 rad, knees 0.75 rad | pass |
| `Slash` strip | Right arm moves; `RightArmPivot` range 1.84 rad within 0.05 | Right arm swings out in frame 4; log 1.84 rad; the GLB's own track, measured from its quaternions with node, is 1.845 rad | pass |
| `Idle` strip | Every printed range under 0.07 rad | Largest 0.06 rad (`LeftElbowPivot`, `RightElbowPivot`); the GLB's own tracks agree to 0.001 | pass |
| Silhouette sheets | Pure black on white | Hero 99.2% and guard 99.2% of pixels at luma 16 or less or 239 or more; the rest sit on figure edges (anti-aliasing and JPEG ringing). No grey fill, no shading inside the figure | pass |

No mismatch was found, so no follow-up fix of `review_render.py` is needed before V3.

**Note on the guard.** In all three views, both of the guard's gauntlets stand apart from the upper arms, with a visible gap at the elbow, in the colour sheet and the silhouette alike. The renderer cannot cause this: `guard.glb` has no skin, no animation and no node rotation or scale (27 meshes directly under `CastleGuard`), and the renderer moves no node of a figure without clips. The gap is in the shipped geometry; the earlier renders hid it by camera angle. V3's note on `guard.glb` should name it, and the V4 in-engine capture shows whether the game shows it too.

**Note on the `Walk` strip.** The camera faces the figure's front, so the stride reads as feet lifting in turn, not as legs swinging forward and back. A side view of motion would show the arc better; it is not needed to prove the clip plays.
