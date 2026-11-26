# Stage 6 models lane (plan O-6.1b.6): sheets and records

# MK1: the Cinder Adept kit on the dark wizard

This is a repair round. The first MK1 run left no commit on `cs/models`, so the task was done again from `d83bc9a`. It follows the plan's amendment "O-6.1b.6 amendment: kit child names" (2026-11-26):
- every kit child is named `<kit>_<Bone>`;
- MK1 builds the hood;
- the two shipped kits' children are renamed in `build_monsters.py`.

Built with `BLEND(monsters)` on Blender 5.0.1 from `d83bc9a` plus this task's builder:

```
flock /tmp/claude-blender.lock timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs monsters --out scratch/models-build/mk1
```

The build exits 0 in about 10 s. Nothing is promoted: `git status --short public/models blender` prints nothing. MP6 promotes the file and makes the loader and test change of the amendment. D4 gives the row its `kit`.

## Open for the main session

1. **SUITE has two known red cases until MP6.** `tests/monster-models.test.ts` reads the pending manifest when one exists. Its kit case expects each child of `Kit_saltback_stalker` and `Kit_thornwatch_marksman` to be a bare bone name. Those children are now `saltback_stalker_<Bone>` and `thornwatch_marksman_<Bone>`, so two cases fail:
   - `saltback_stalker_Hips names a bone of scorpion`;
   - `thornwatch_marksman_HeadGroup names a bone of dark_ranger`.

   The amendment gives that case's new assertion (each child carries the `<kit>_` prefix, and the name without it is a bone) to MP6 as a declared edit, together with the loader. The test is frozen for MK1, so it was not touched. Every other test passes.
2. **The shipped loader cannot mount a prefixed child.** `upgradeMonsterRigWithGltf` (`blenderMonsters.ts` 116) matches a child to a bone by exact name. It would add every prefixed piece to the figure's root, not to its bone. So the file must not ship before MP6's loader change; the amendment already puts both in one commit. The scratch placement test below runs MP6's rule by hand.
3. **The hood is as wide as the hat it hides.** A kit cannot hide its base, so the hood has to swallow the wizard's hat. The hat's brim is 0.96 across (radius 0.48 by 0.46 round (0, 2.0, −0.12)), and its crown bends back to a tip at (0.10, 2.47, 0.31).
   - The hood is 1.01 across at the brim and 1.26 at the shoulder hem.
   - It reads as a deep cowl with a short mantle and a peak that droops back. Its mouth is open on the face, the violet glints and the beard, and the inside is lit ember.
   - Because it rides `HeadGroup` rigidly, the mantle turns with the head. In the worst pose (head turned 0.8 rad) the mantle swings over the shoulders and shows its lining (`mk1-adept-worst-pose.jpg`).

   Whether the size "makes sense" is the owner's call on the sheets and at MP6.
4. **No tint yet.** The content file gives the row only `tintNote: 'ash grey robe, ember trim'` and no hex value, so the sheets are untinted. Design 5.6's 15 value points depend on that tint (D4's row).
5. **Not seen in the engine.** MK1's accept has no capture, and none was taken. MP6's capture should look at three things:
   - the outline pass on the hood's inner shell;
   - the right arm, which passes through the hood's side in `Cast`, as it already crosses the hat's brim;
   - the face and glints under the hood's lip, which a camera looking down will likely hide.
6. **MK2 and MK3**: under the amendment, every bone is free for a new kit (children are `slag_brute_<Bone>` and `marrowjaw_<Bone>`). The naming no longer blocks them.

## What was built

`build_cinder_adept_kit` is called in `main()` after `build_dark_wizard`. It goes through K2's `_kit_root` with `wizard_joints()`. `_kit_root` now names each child `<key>_<bone>` (object and mesh) and refuses a taken name as before.

For `Kit_saltback_stalker` and `Kit_thornwatch_marksman`, only the child node names change, from `Hips`, `HeadGroup` and so on to `saltback_stalker_Hips`, `thornwatch_marksman_HeadGroup` and so on. Their mesh names were already `<kit>_<Bone>`, and their geometry is identical (below). `Monster_dark_wizard` and every other builder are unchanged.

| Child (bone) | What it is | Material |
|---|---|---|
| `cinder_adept_HeadGroup` | the hood: a faceted 14-sided bell over the head and hat, from a mantle hem at y 1.60 (radius 0.60 by 0.56) to a peak at y 2.64 that droops back to z 0.40. It is a solidified shell 0.03 thick with its rims filled. The mouth is cut where the face is: the faces with three-space z < −0.30 between the rings at y 1.60 and 1.95. A ring at 1.95 keeps the faces from 1.95 to 2.04 whole, so the brim (y 2.00 to 2.05, front edge at z −0.58) stays inside the hood. A first build without that ring opened the mouth to 2.04 and showed the brim's edge. Outside it is ash grey with plane tones; every face that looks into the hood is painted ember | `mat_robe_dark_wizard_paint` (the wizard's own) |
| `cinder_adept_WeaponPivot` | an eight-sided faceted iron bowl, 0.345 long and 0.265 at the lip, starting 0.05 under the staff head. It swallows the wizard's three prongs and purple orb (the orb has radius 0.10, 0.13 up the staff). Above it sit an ember band round the rim and four iron tines (0.24) leaning out | `mat_wood_dark_wizard_paint` (the wizard's own) |
| `cinder_adept_RightHand` | the fire: one six-sided flame 0.52 tall out of the bowl, and six tongues (0.22 and 0.30) leaning out round it | `mat_glow_orange` |
| `cinder_adept_LeftHand` | an ember held 0.15 over the open left hand: a faceted coal (0.085) with three tongues | `mat_glow_orange` |

- **One material per piece.** `_kit_root` refuses a piece with two materials. So the fire rides `RightHand` and the iron rides `WeaponPivot`. The two bones share one joint, and nothing moves one against the other:
  - no clip has a track on either bone (checked over all eleven clips of `hero.glb`, the biped library);
  - no code under `src/` names `WeaponPivot`, `RightHand` or `LeftHand` (`grep -rn -i "weaponPivot\|'RightHand'\|'LeftHand'\|rightHand\b" src/` prints nothing), so neither the wind-up nor the flinch poses them.

  They therefore move as one.
- **Additive only.** Each piece goes over the wizard. The hat, prongs and orb are inside the hood and the bowl.
- **Faceted.** Every piece is flat-shaded. The hood's outside and the iron carry plane tones; the lining, the rim and the fire are flat colour.
- **Paint**, before any tint: hood `0x5E5852`, lining and rim `0xBC5C28` (over the cloth tile's mean on the robe material, over the wood tile's mean on the wood material, as `_human_paint` does), iron `0x4A423C`, fire `0xFFFFFF` on the glow material (as the wizard's orb is). No material is added: the file stays at 34. Every kit primitive carries `COLOR_0`, and the manifest lists `Kit_cinder_adept` as its own `all` unit. UV layers are dropped.
- **Budget**: 1,060 of the 1,200 triangles allowed, 4 meshes (the ceiling of final.md item 6), 3 materials. The builder stops over 1,200.

## Values

The checks are design 5.4 (value range 25% to 75%, nothing under 18%) and 5.6 (a variant differs from its base by one silhouette element that survives the 85 px cut-out, by 15 points of value, and by size). The measures are Rec. 601 luma, which K1 and K2 used, and HSV value, which 5.4's range uses.

| Colour | Luma | HSV value |
|---|---|---|
| Kit hood `0x5E5852` | 35% | 37% |
| Kit lining and rim `0xBC5C28` | 45% | 74% |
| Kit iron `0x4A423C` | 27% | 29% |
| Kit fire (white on `mat_glow_orange`, base `0xD97706`, emissive) | 53% | 85% (glow) |
| Wizard robe `0x40346A` | 24% | 42% |
| Wizard robe dark `0x2C2550` (hat crown, collar) | 17% | 31% |
| Wizard staff `0x6E5034` | 34% | 43% |

| Rule | Result |
|---|---|
| 5.4 range 25% to 75% (HSV value) | met: hood 37%, lining and rim 74%, iron 29%. The first build's rim `0xC8642A` was 78%; it was changed and rebuilt. The fire is the one glow, which 5.4 allows |
| 5.4 floor 18% | met: the darkest kit paint is the iron at 27% luma |
| 5.4 at most one emissive, at most five materials | met: the kit adds glow on `mat_glow_orange` only. The wizard's purple orb is inside the bowl. The glints, which keep the wizard's glow, sit inside the hood's mouth |
| 5.6.1 a silhouette element that survives 85 px | met: the peaked hood replaces the pointed hat with its brim, and the brazier and fire stand above the head (`mk1-adept-silhouette.jpg`) |
| 5.6.2 value 15 points from the base | the figure's value is set by the row's tint, which is D4's (item 4). Piece against piece, the hood's outside is 11 points of luma over the robe (35 against 24) and 18 over the hat it hides (17) |
| 5.6.3 size | the content file's `modelScale` 1.08 (D4's row) |

## Measured

`node scratch/mk1/stats.mjs` (K2's `stats.mjs`). "Packed" is `packGlb`, as the promote step packs it (`node scratch/mk1/pack.mjs <in.glb> <out.glb> [manifest.json]`).

| | As exported | Packed |
|---|---|---|
| Kit triangles / meshes / materials | 1,060 / 4 / 3 | same |
| Kit raw bytes | 72,824 | 47,900 |
| Kit Brotli bytes | 19,791 | 15,460 |
| File raw / Brotli | 3,767,300 / 1,527,910 | 2,300,336 / 938,308 |
| File meshes / materials / triangles | 50 / 34 / 60,334 | same |

The packed kit is 15.5 kB against the 20 kB kit ceiling.

**Untouched figures**: compared with a build of `d83bc9a` without this task (`scratch/models-build/base`, built the same way), the primitive hashes of all 13 roots are identical. That covers every `Monster_` figure, `dark_wizard` among them, and both renamed kits.

## Pending manifest and COMPARE

`tests/fixtures/model-contract/pending/monsters.json` did not exist on this branch. `python3 scratch/mk1/make_pending.py` writes it as a full copy of the live `monsters.json` at `d83bc9a`, with these changes:
- `nodes`:
  - the seven children of the two shipped kits take their kit's prefix, in place: `saltback_stalker_Hips`, `_TailPivot3`, `_LeftElbowPivot` and `_RightElbowPivot`; `thornwatch_marksman_HeadGroup`, `_Torso` and `_OffhandPivot`;
  - new: `Kit_cinder_adept` (no parent) and `cinder_adept_HeadGroup`, `_WeaponPivot`, `_RightHand` and `_LeftHand` (parent `Kit_cinder_adept`);
  - all of them at translation 0 and scale 1;
- `meshClasses`: `^cinder_adept_(HeadGroup|WeaponPivot|RightHand|LeftHand)$`;
- `vertexColor.figures.Kit_cinder_adept`: `all`;
- `figures.Kit_cinder_adept`: 1,200 triangles, 4 meshes, 3 materials, raw 47,900 (packed), Brotli 20,000. These are the kit row of final.md item 6 and the two shipped kits' entries;
- file `budget`: only the ceilings the packed build exceeds are raised, to `buildManifest`'s numbers for it: triangles from 59,274 to 60,334, meshes from 46 to 50, and raw bytes from 2,271,135 to 2,323,340. Brotli stays 1,270,000 and materials stay 34.

No other figure's ceiling moved. The material set and the clips are unchanged.

| COMPARE | Exit | Result |
|---|---|---|
| Base build of `d83bc9a`, packed, against the live manifest | 0 | Contract and Budget pass |
| This build, packed (`scratch/models-build/mk1-packed/monsters.glb`), against the pending manifest | **0** | Contract and Budget pass. Drift lists:<ul><li>the seven renamed kit children, each added under its new name and removed under its old one;</li><li>the five new kit nodes and four new kit meshes;</li><li>`goblin_body` and `goblin_archer_body` changing bytes, as they do in the base build.</li></ul> |
| This build, as exported | 2 | Budget only, on the packed ceilings, as for K1 and K2. Contract passes |

## Checks

**On the branch at the builder commit:**

| Check | Command | Result |
|---|---|---|
| `SUITE` | `flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run` | exit 1: 129 of 130 files pass; 2 failed, 1,426 passed, 3 skipped. The two failures are the `monster-models` kit cases of item 1 (MP6's declared edit) |
| `TYPES` | `flock /tmp/claude-capped.lock scripts/capped.sh npx tsc --noEmit` | exit 0, no output |
| `BUILD` | `flock /tmp/claude-capped.lock scripts/capped.sh npm run build` | exit 0. JS chunk 1,097.21 kB (gzip 311.09 kB), CSS 37.73 kB, reported and not a ceiling |
| `UNTOUCHED` | `git status --short public/models blender` | prints nothing |

**Built-file check (`monster-motion`)**, run in this worktree:
- Setup: the packed build copied over `public/models/monsters.glb`, and a scratch placement test copied to `tests/mk1-kit-engine.test.ts`.
- Command: `flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run tests/monster-motion.test.ts tests/monster-libraries.test.ts tests/monster-kits.test.ts tests/mk1-kit-engine.test.ts`.
- Afterwards: the file was restored with `git checkout public/models/monsters.glb` and the scratch test was deleted.

The result: exit 0, 4 files, 45 passed, 3 skipped.
- `monster-motion`: 38 passed and 3 skipped. The wizard's row plays the biped library's clips from the built file.
- `monster-libraries`: 2 passed.
- `monster-kits`: 6 passed.
- The scratch placement test (`scratch/mk1/kit-engine.test.ts`, K2's adapted, not committed): 2 passed. It loads the built file through `GLTFLoader` and `upgradeMonsterRigWithGltf` on the `dark_wizard` row with `kit: 'cinder_adept'`. It then moves each `cinder_adept_<Bone>` piece under `<Bone>` (MP6's rule, done by hand, since today's loader leaves them on the root) and checks these points:
  - all four pieces find their bone;
  - `getObjectByName` and `PropertyBinding.findNode` find the bone for each bare name;
  - no rig pivot the loader resolves is a kit mesh;
  - each piece's world bounds equal its own bounds moved by its joint, within 1e-4;
  - every piece has `vertexColors`, and both fire pieces are emissive;
  - turning `RightArmPivot` moves the brazier;
  - without the kit field, no piece is added.

World bounds of the pieces at rest (figure space):

| Piece | x | y | z |
|---|---|---|---|
| Hood | ±0.63 | 1.60 to 2.67 | −0.65 to 0.57 |
| Brazier | 0.28 to 0.84 | 2.02 to 2.56 | −0.48 to 0.08 |
| Fire | 0.36 to 0.78 | 2.30 to 2.85 | −0.41 to 0.01 |
| Ember | −0.70 to −0.53 | 1.12 to 1.43 | −0.29 to −0.13 |

## Sheets

The sheets come from `scratch/mk1/kit_render.py`, which is not committed. It drives `review_render.py`'s renderer, the same as K2's `kit_render.py`, with one difference: each kit child is bone-parented to the wizard bone its name gives (without the `cinder_adept_` prefix), at the bone's rest joint. It therefore follows a pose the way the engine mounts it. The run exits 0:

```
flock /tmp/claude-blender.lock timeout 600 /usr/bin/blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python scratch/mk1/kit_render.py -- scratch/models-build/mk1/monsters.glb scratch/mk1/sheets
```

| Sheet | What it shows |
|---|---|
| `mk1-adept-turnaround.jpg` | the adept, from `review_render`'s turnaround: front three-quarter, side and back three-quarter, 512 px, 444 px tall |
| `mk1-adept-worst-pose.jpg` | the adept in `review_render`'s worst pose: crouch, right arm overhead, trunk twisted, head turned. The brazier and fire stay on the staff head and the ember on the left hand. The hood turns with the head |
| `mk1-adept-silhouette.jpg` | **the 85 px silhouette sheet** (design 5.6): black cut-outs at the roster's camera (distance 26, 1080 frame), in pairs of wizard then adept, from the front, three-quarter, side and back. The wizard is at review scale 1.02 and the adept at 1.1016 (× the content file's `modelScale` 1.08). Heights in px: front 115 and 135, three-quarter 119 and 138, side 119 and 139, back 110 and 138 |
| `mk1-adept-against.jpg` | lit and untinted, the wizard then the adept, at three-quarter (top) and side (bottom) |

**Reading the cut-outs:**
- The wizard's pointed hat with its wide flat brim becomes a peaked cowl that falls to the shoulders.
- The staff ends in a wide bowl with flame tongues standing above the hood in every view, where the wizard's ends in a small orb at hat height.
- A flame shape stands over the left hand.
