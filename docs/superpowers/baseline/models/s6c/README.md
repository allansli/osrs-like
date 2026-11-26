# Stage 6 models lane (plan O-6.1b.6): sheets and records

# MK1: the Cinder Adept kit on the dark wizard

This is a repair round. The first MK1 run left no commit on `cs/models`, so the task was done again from `d83bc9a`. It follows the plan's amendment "O-6.1b.6 amendment: kit child names" (2026-11-26):
- every kit child is named `<kit>_<Bone>`;
- MK1 builds the hood;
- the two shipped kits' children are renamed in `build_monsters.py`.

Built with `BLEND(monsters)` on Blender 5.0.1 from `d83bc9a` plus this task's builder:

```
flock /tmp/claude-blender.lock timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs monsters --out scratch/models-build/mk1b
```

The build exits 0 in about 10 s.

**Art fix (second round, main session's judgement of `mk1-adept-against.jpg`).** The first hood read as an oversized grey box above the head: wider than the shoulders (1.26 at the hem) and taller than the face (peak at y 2.67). The figure no longer read as a person in a hood. The hood is now fitted:
- it wraps the skull and falls to the shoulders;
- its opening frames the face and beard;
- its top stops at y 2.00, under the old hat brim;
- the ember lining shows only at the opening.

The brazier, fire and ember are unchanged. Every number, sheet and check below is from that rebuild, in `scratch/models-build/mk1b`, packed as `mk1b-packed`.

Nothing is promoted: `git status --short public/models blender` prints nothing. MP6 promotes the file and makes the loader change of the amendment; MK1 made its declared test edit. D4 gives the row its `kit`.

## Open for the main session

1. **The fitted hood no longer hides the hat, and the hat shows on the adept.** A kit only adds pieces: the loader's kit loop attaches children and hides nothing, and no engine code hides a monster mesh by name. The hat (brim 0.96 across at y 2.00 to 2.05, crown tip at y 2.47) is part of the wizard's skinned robe mesh. Any hood that hid it would be at least 0.97 wide at brow height and reach y 2.5, which is the box the main session rejected. So the hood is worn **under** the hat: its open top ring (y 1.995) is covered by the brim, and the adept reads as a person in a grey hood and mantle with the wizard's hat on top.
   - The silhouette element that survives 85 px is now the brazier and its fire, the flame over the left hand and the mantle's bulk on the shoulders, not the head's outline (see Values).
   - If the owner wants the hat gone, there are two exits:
     - a declared change at MP6: the wizard's hat becomes its own named mesh, and the loader hides it when a row has a kit (this touches `_wizard_kit`, `blenderMonsters.ts` and the wizard's manifest entry);
     - accepting a hood large enough to swallow the hat, as the first round built.
   - The owner decides this on the sheets.
   - **The kit case is resolved.** `tests/monster-models.test.ts`'s kit case was edited, as the amendment declares (commit `test(MK1)`). It reads the pending manifest when one exists, and it asserts two things for each child of a `Kit_` node: the child carries the `<kit>_` prefix, and the name without the prefix is a bone of the model. SUITE is green (Checks).
2. **The shipped loader cannot mount a prefixed child.** `upgradeMonsterRigWithGltf` (`blenderMonsters.ts` 116) matches a child to a bone by exact name. It would add every prefixed piece to the figure's root, not to its bone. So the file must not ship before MP6's loader change; the amendment already puts both in one commit. The scratch placement test below runs MP6's rule by hand.
3. **The hood's size.** The hood is 0.82 across at the shoulder hem (y 1.55), about the shoulders' width (the shoulder balls reach ±0.36). It is 0.52 across at y 1.90 and 0.37 at its top (y 2.00).
   - It stands clear of the skull by 0.08 to 0.16, and of the wizard's high collar (0.52 across at y 1.86) behind the head.
   - Because it rides `HeadGroup` rigidly, the mantle turns with the head. In the worst pose (head turned 0.8 rad) it swings over the shoulders. It is small enough now to stay mostly behind the raised arm (`mk1-adept-worst-pose.jpg`).
   - **Emissive (OM-S6c, owner look check, not a defect):** the adept shows two glows, the wizard's violet glints under the brow and the kit's orange fire. The amendment allows a kit's fire its own emissive beside the base's.
4. **No tint yet.** The content file gives the row only `tintNote: 'ash grey robe, ember trim'` and no hex value, so the sheets are untinted. Design 5.6's 15 value points depend on that tint (D4's row).
5. **Not seen in the engine.** MK1's accept has no capture, and none was taken. MP6's capture should look at three things:
   - the outline pass on the hood's inner shell;
   - the right arm in `Cast`, against the mantle's side (not checked on the fitted hood; the first round's hood was crossed by it, as the hat's brim is);
   - the face and glints, which sit under the hat's brim inside the hood's mouth, and which a camera looking down may hide (not checked on the fitted hood).
6. **MK2 and MK3**: under the amendment, every bone is free for a new kit (children are `slag_brute_<Bone>` and `marrowjaw_<Bone>`). The naming no longer blocks them.

## What was built

`build_cinder_adept_kit` is called in `main()` after `build_dark_wizard`. It goes through K2's `_kit_root` with `wizard_joints()`. `_kit_root` now names each child `<key>_<bone>` (object and mesh) and refuses a taken name as before.

For `Kit_saltback_stalker` and `Kit_thornwatch_marksman`, only the child node names change, from `Hips`, `HeadGroup` and so on to `saltback_stalker_Hips`, `thornwatch_marksman_HeadGroup` and so on. Their mesh names were already `<kit>_<Bone>`, and their geometry is identical (below). `Monster_dark_wizard` and every other builder are unchanged.

| Child (bone) | What it is | Material |
|---|---|---|
| `cinder_adept_HeadGroup` | the hood: a fitted, faceted 14-sided cowl worn under the hat. Six rings: a mantle hem at y 1.56 (radius 0.41 by 0.33), then 1.68 and 1.80 over the shoulders, then 1.90 and 1.97 round the skull. An open top ring at y 1.995 (0.185 by 0.21) sits just under the brim (y 2.00), so the brim covers it. It is a solidified shell 0.03 thick with its rims filled. The mouth is the three front columns (faces with three-space z < −0.28) from the hem to y 1.97. It is about 0.32 across at the face and frames the face, the glints and the beard. The band from 1.97 to 1.995 stays whole as a brow under the brim. Outside it is ash grey with plane tones. Ember is painted only on the inner faces of the front half (three z < −0.05), which the mouth shows. Two earlier cuts of this round (z < −0.17, then −0.21) took five columns and left the hood as two side flaps | `mat_robe_dark_wizard_paint` (the wizard's own) |
| `cinder_adept_WeaponPivot` | an eight-sided faceted iron bowl, 0.345 long and 0.265 at the lip, starting 0.05 under the staff head. It swallows the wizard's three prongs and purple orb (the orb has radius 0.10, 0.13 up the staff). Above it sit an ember band round the rim and four iron tines (0.24) leaning out | `mat_wood_dark_wizard_paint` (the wizard's own) |
| `cinder_adept_RightHand` | the fire: one six-sided flame 0.52 tall out of the bowl, and six tongues (0.22 and 0.30) leaning out round it | `mat_glow_orange` |
| `cinder_adept_LeftHand` | an ember held 0.15 over the open left hand: a faceted coal (0.085) with three tongues | `mat_glow_orange` |

- **One material per piece.** `_kit_root` refuses a piece with two materials. So the fire rides `RightHand` and the iron rides `WeaponPivot`. The two bones share one joint, and nothing moves one against the other:
  - no clip has a track on either bone (checked over all eleven clips of `hero.glb`, the biped library);
  - no code under `src/` names `WeaponPivot`, `RightHand` or `LeftHand` (`grep -rn -i "weaponPivot\|'RightHand'\|'LeftHand'\|rightHand\b" src/` prints nothing), so neither the wind-up nor the flinch poses them.

  They therefore move as one.
- **Additive only.** Each piece goes over the wizard. The prongs and orb are inside the bowl. The hat stays visible on top of the hood (open item 1).
- **Faceted.** Every piece is flat-shaded. The hood's outside and the iron carry plane tones; the lining, the rim and the fire are flat colour.
- **Paint**, before any tint: hood `0x5E5852`, lining and rim `0xBC5C28` (over the cloth tile's mean on the robe material, over the wood tile's mean on the wood material, as `_human_paint` does), iron `0x4A423C`, fire `0xFFFFFF` on the glow material (as the wizard's orb is). No material is added: the file stays at 34. Every kit primitive carries `COLOR_0`, and the manifest lists `Kit_cinder_adept` as its own `all` unit. UV layers are dropped.
- **Budget**: 836 of the 1,200 triangles allowed, 4 meshes (the ceiling of final.md item 6), 3 materials. The builder stops over 1,200.

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
| 5.4 at most one emissive, at most five materials | two emissives on the figure: the wizard's violet glints and the kit's orange fire (on `mat_glow_orange`). The wizard's purple orb is inside the bowl. The amendment allows the kit's fire its own emissive, so this is owner look check OM-S6c, not a defect. Three materials in the kit |
| 5.6.1 a silhouette element that survives 85 px | met by the staff head: the brazier with its fire stands above the hat in every view, where the wizard's staff ends in a small orb at hat height. The flame over the left hand and the mantle's bulk on the shoulders add to it. The head's outline is the wizard's (pointed hat and brim), because the fitted hood sits under it (item 1) (`mk1-adept-silhouette.jpg`) |
| 5.6.2 value 15 points from the base | the figure's value is set by the row's tint, which is D4's (item 4). Piece against piece, the hood's outside is 11 points of luma over the robe (35 against 24) |
| 5.6.3 size | the content file's `modelScale` 1.08 (D4's row) |

## Measured

`node scratch/mk1/stats.mjs` (K2's `stats.mjs`). "Packed" is `packGlb`, as the promote step packs it (`node scratch/mk1/pack.mjs <in.glb> <out.glb> [manifest.json]`).

| | As exported | Packed |
|---|---|---|
| Kit triangles / meshes / materials | 836 / 4 / 3 | same |
| Kit raw bytes | 57,144 | 37,596 |
| Kit Brotli bytes | 15,531 | 12,194 |
| File raw / Brotli | 3,751,616 / 1,522,982 | 2,290,028 / 934,404 |
| File meshes / materials / triangles | 50 / 34 / 60,110 | same |

The packed kit is 12.2 kB against the 20 kB kit ceiling. The first round's kit was 1,060 triangles and 15.5 kB packed.

**Untouched figures**: compared with a build of `d83bc9a` without this task (`scratch/models-build/base`, built the same way), the primitive hashes of all 13 roots are identical. That covers every `Monster_` figure, `dark_wizard` among them, and both renamed kits.

## Pending manifest and COMPARE

`tests/fixtures/model-contract/pending/monsters.json` did not exist on this branch. `python3 scratch/mk1/make_pending.py` writes it as a full copy of the live `monsters.json` at `d83bc9a`, with these changes:
- `nodes`:
  - the seven children of the two shipped kits take their kit's prefix, in place: `saltback_stalker_Hips`, `_TailPivot3`, `_LeftElbowPivot` and `_RightElbowPivot`; `thornwatch_marksman_HeadGroup`, `_Torso` and `_OffhandPivot`;
  - new: `Kit_cinder_adept` (no parent) and `cinder_adept_HeadGroup`, `_WeaponPivot`, `_RightHand` and `_LeftHand` (parent `Kit_cinder_adept`);
  - all of them at translation 0 and scale 1;
- `meshClasses`: `^cinder_adept_(HeadGroup|WeaponPivot|RightHand|LeftHand)$`;
- `vertexColor.figures.Kit_cinder_adept`: `all`;
- `figures.Kit_cinder_adept`: 1,200 triangles, 4 meshes, 3 materials, raw 37,596 (packed), Brotli 20,000. These are the kit row of final.md item 6 and the two shipped kits' entries;
- file `budget`: only the ceilings the packed build exceeds are raised, to `buildManifest`'s numbers for it: triangles from 59,274 to 60,110, meshes from 46 to 50, and raw bytes from 2,271,135 to 2,312,929. The script was rerun on the new build. The first round's numbers (60,334 and 2,323,340) are gone. Brotli stays 1,270,000 and materials stay 34.

No other figure's ceiling moved. The material set and the clips are unchanged.

| COMPARE | Exit | Result |
|---|---|---|
| Base build of `d83bc9a`, packed, against the live manifest | 0 | Contract and Budget pass |
| This build, packed (`scratch/models-build/mk1b-packed/monsters.glb`), against the pending manifest | **0** | Contract and Budget pass. Drift lists:<ul><li>the seven renamed kit children, each added under its new name and removed under its old one;</li><li>the five new kit nodes and four new kit meshes;</li><li>`goblin_body` and `goblin_archer_body` changing bytes, as they do in the base build.</li></ul> |
| This build, as exported | 2 | Budget only (25 lines), on the packed ceilings, as for K1 and K2. Contract passes |

## Checks

**On the branch after the art fix** (`test(MK1)` and the builder commit):

| Check | Command | Result |
|---|---|---|
| `ONE` | `flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run tests/monster-models.test.ts` | exit 0: 19 passed, the two kit cases among them |
| `SUITE` | `flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run` | exit 0: 130 files passed; 1,428 passed, 3 skipped |
| `TYPES` | `flock /tmp/claude-capped.lock scripts/capped.sh npx tsc --noEmit` | exit 0, no output |
| `BUILD` | `flock /tmp/claude-capped.lock scripts/capped.sh npm run build` | exit 0. JS chunk 1,097.21 kB (gzip 311.09 kB), CSS 37.73 kB, reported and not a ceiling |
| `UNTOUCHED` | `git status --short public/models blender` | prints nothing |

The untouched-figures check was repeated on the new build: all 13 roots hash as in the base build of `d83bc9a`. Only `cinder_adept` is new.

**Built-file check (`monster-motion`)**, run in this worktree:
- Setup: the packed build (`mk1b-packed`) copied over `public/models/monsters.glb`, and a scratch placement test copied to `tests/mk1-kit-engine.test.ts`.
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
| Hood | ±0.41 | 1.55 to 2.00 | −0.32 to 0.30 |
| Brazier | 0.28 to 0.84 | 2.02 to 2.56 | −0.48 to 0.08 |
| Fire | 0.36 to 0.78 | 2.30 to 2.85 | −0.41 to 0.01 |
| Ember | −0.70 to −0.53 | 1.12 to 1.43 | −0.29 to −0.13 |

## Sheets

The sheets come from `scratch/mk1/kit_render.py`, which is not committed. It drives `review_render.py`'s renderer, the same as K2's `kit_render.py`, with one difference: each kit child is bone-parented to the wizard bone its name gives (without the `cinder_adept_` prefix), at the bone's rest joint. It therefore follows a pose the way the engine mounts it. The run exits 0:

```
flock /tmp/claude-blender.lock timeout 600 /usr/bin/blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python scratch/mk1/kit_render.py -- scratch/models-build/mk1b/monsters.glb scratch/mk1/sheets-b
```

| Sheet | What it shows |
|---|---|
| `mk1-adept-turnaround.jpg` | the adept, from `review_render`'s turnaround: front three-quarter, side and back three-quarter, 512 px, 444 px tall |
| `mk1-adept-worst-pose.jpg` | the adept in `review_render`'s worst pose: crouch, right arm overhead, trunk twisted, head turned. The brazier and fire stay on the staff head and the ember on the left hand. The hood turns with the head |
| `mk1-adept-silhouette.jpg` | **the 85 px silhouette sheet** (design 5.6): black cut-outs at the roster's camera (distance 26, 1080 frame), in pairs of wizard then adept, from the front, three-quarter, side and back. The wizard is at review scale 1.02 and the adept at 1.1016 (× the content file's `modelScale` 1.08). Heights in px: front 115 and 135, three-quarter 119 and 137, side 119 and 138, back 110 and 138 |
| `mk1-adept-against.jpg` | lit and untinted, the wizard then the adept, at three-quarter (top) and side (bottom) |

**Reading the cut-outs:**
- The head keeps the wizard's pointed hat and brim. The fitted hood under it adds a mantle that rounds and thickens the shoulders.
- The staff ends in a wide bowl with flame tongues standing above the hat in every view, where the wizard's ends in a small orb at hat height. This is the element that tells the two apart at 85 px.
- A flame shape stands over the left hand.

**Reading the lit sheets (side view judged too):**
- From the front three-quarter, the hood's grey sides and its ember edge frame the face and beard under the brim. The figure reads as a person in a hood with a hat on top.
- From the side, the mantle falls from under the brim over the back and shoulders, and the hood's top is not seen. The mantle stands off the back: its hem reaches three z 0.30 at y 1.55, where the wizard's collar ends at 0.18 (y 1.86) and the back of the skull at 0.02. Above the shoulders, only the hat stands proud of the head.
- From the back, a grey cowl covers the nape and shoulders.
- Nothing intersects visibly in the rest views. In the worst pose, the rigid mantle turns with the head and partly crosses the raised right arm, as the first round's did.
