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
