# Slice 2: the hero

## H3b: two Accept items that are open (2026-11-25)

Plan task H3b lists `ONE(tests/gear-mount.test.ts)` green against the built file and CAPTURE(hero) in its Accept. Neither has been met on `feat/models-pass-hero`. Both need H5b, and H5b is not on this branch or any other: no branch's `src/engine/blenderHero.ts` calls `cloneFigure` or `hasSkin`.

**`gear-mount` against the built file: 7 of 7 fail.** The run used `scratch/models-build/hero.glb` (296,028 bytes, H3b's build at `41a22c2`). The test was copied unchanged to scratch, with only the `hero.glb` path pointed at the build, and run with `scripts/capped.sh npx vitest run`. Every case throws:

```
TypeError: Cannot read properties of null (reading 'center')
 ❯ src/engine/materials.ts:199:66   (skinnedMesh.boundingSphere is null)
 ❯ addCartoonOutline src/engine/materials.ts:187:10
 ❯ upgradeHumanoidRigWithGltf src/engine/blenderHero.ts:322:3
```

Today's hero loader takes the rigid path for every file. On a skinned file it gives a `SkinnedMesh` that has no bounding sphere to `addCartoonOutline`, so the test stops before it measures any mount. This is the loader H5b writes (`cloneFigure` when the file has a skin, and the mount offsets moved by the joint move, design 6.1.3 and 6.1.4). The H3b build is not the cause. Against the shipped `public/models/hero.glb`, the same test passes 7 of 7.

Supporting evidence, which does not replace the mount test: the pending manifest `tests/fixtures/model-contract/pending/hero.json` pins the Hands, Boots and Head centres (by `extras.part`) at the shipped values. H3b's commit `6cd0164` reports two things about the built file: the Head's bounds centre moves 0.0018 with the face planes, and the builder stops above 0.005. It also reports that the hands were scaled about their own centres.

**CAPTURE(hero): not taken.** An in-engine capture of the built hero goes through the same `upgradeHumanoidRigWithGltf`, so it fails in the same place until H5b lands. The only sheets in this directory are Blender sheets (`h3b-*.jpg`).

**For the main session:** either amend H3b's Accept so that both items run after H5b (with H5b and H5 applied, in a throw-away worktree of the built file), or run them there once H5b exists. This note records the gap; it does not decide it.

## H3b repair: the hands' paint (2026-11-25)

The source's hand faces point into the hand: 180 of 180 faces of the shipped `Hand_L`/`Hand_R`, and 354 of 360 `Hands` faces of the H3b build, cast a ray along their normal that hits the back of the hand's own far wall within 0.1. `bake_paint`'s Cycles AO therefore read every hand vertex as fully occluded, and all 1,080 hand corners exported between 0.57 and 0.62: one dark value with no form. `grow_hands` in `scripts/blender/build_hero.py` now turns the hand faces outward (`bmesh.ops.recalc_face_normals`) before `paint()`.

On the rebuilt file, no `Hands` face's normal ray hits the back of a wall; 66 of 360 hit the front of another surface within 0.1 (the fingers and the gaps between them). The hand corners now run from 0.60 to 0.94 (mean of the three channels; median 0.84, tenth percentile 0.70), so the occlusion sits in the creases only. COMPARE: Contract and Budget pass; file 296,028 bytes, as before. The sheets `h3b-hero-{turnaround,play-distance,against,paint-turnaround,paint-play-distance}.jpg` are re-rendered from this build; the silhouette and worst-pose sheets came out byte-identical. The plate-set sheets are not re-rendered: the gloves cover the hands there.

The two open Accept items above (`gear-mount` against the built file, CAPTURE(hero)) are unchanged by this repair: both still wait on H5b's skinned loader or a main-session amendment that moves them after H5b.
