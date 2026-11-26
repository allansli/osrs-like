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

# MK2: the Slag Brute kit on the hill giant

Built from `8a2a21f` plus this task's builder (commits `feat(models-s6c): MK2` and `feat(models-s6c): MK2 fix`), with `BLEND(monsters)` on Blender 5.0.1:

```
flock /tmp/claude-blender.lock timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs monsters --out scratch/models-build/mk2
```

The build exits 0 and prints `[Blender] slag_brute kit: 934 triangles in 4 pieces`. It is packed as `scratch/models-build/mk2-packed`. Every number, sheet and check below comes from that build.

Nothing is promoted: `git status --short public/models blender` prints nothing. The built-file checks read the scratch file directly, and nothing was copied over `public/models`. MP6 promotes the file and makes the amendment's loader change. D4 gives the row `kit: 'slag_brute'` and its tint.

## Open for the main session

1. **The cracks are paint, not glow, and the row's tint will darken them.** The engine multiplies every non-glow material by the row's `tint`, kit pieces included (`blenderMonsters.ts` 189-190). The content file's `tintNote` is "dark basalt skin, orange cracks", but the row has no hex value yet. Under a dark basalt tint, the ember paint `0xBC5C28` turns brown.
   - A crack that keeps its orange needs a piece on `mat_glow_orange`. That piece needs a bone of its own, because `_kit_root` allows one material per piece. It would be a fifth mesh, over the kit ceiling of 4 (final.md item 6).
   - The owner picks one of two options:
     - a fifth mesh: the kit ceiling is raised for this kit, and the cracks (or the maul's seams alone) go on a glow piece on a bone of their own;
     - painted cracks under whatever tint D4 picks: the lighter the tint, the more orange is left.
   - The loader multiplies every non-glow mesh of the figure by one colour, so no tint can touch the giant's skin and leave the kit alone. That would take a declared loader change.
   - The sheets are untinted, as MK1's are.
2. **No emissive on the figure.** The giant has none, and the kit adds none, so design 5.4's "at most one" holds with nothing to spare. MK1's OM-S6c question does not arise here.
3. **The pauldrons ride the arms, not the trunk.** Each one is centred on its arm's joint, so the Overhead Slam turns it round the shoulder ball and does not drive the raised arm through a plate fixed to the trunk. In the worst pose (`mk2-brute-worst-pose.jpg`), the raised right pauldron tips toward the neck and stays on the shoulder.
4. **Room left for MK3.** Nothing of the brute stands above the skull: the kit's top is the back knob at y 2.07, and the giant's head reaches 2.36. The 85 px read is low and wide: the pauldrons, the back's hump and the maul block. MK3's crown and banner pole above the head therefore have the vertical silhouette to themselves.
5. **Not seen in the engine.** MK2's accept has no capture, and none was taken. MP6's capture should look at two things:
   - the outline pass on the lames' inner shells;
   - the maul against the ground in `Walk` (the kit's lowest point is y 0.011 at rest).

## What was built

`build_slag_brute_kit` is called in `main()` after `build_hill_giant`. It goes through `_kit_root` with `giant_joints()`. Every child is named `slag_brute_<Bone>` (amendment). No other builder changed, and `import random` was added for the slag's knocked corners (`random.Random(58)`, so builds are repeatable).

| Child (bone) | What it is |
|---|---|
| `slag_brute_LeftArmPivot`, `slag_brute_RightArmPivot` | a pauldron of three lames of a dome round the shoulder ball, which has radius 0.20 at the arm's joint. The lames have radii 0.27, 0.29 and 0.31 and cover polar bands 0 to 0.62, 0.52 to 1.02 and 0.93 to 1.42 rad. Each overlaps the one above it. The dome's axis is tilted 0.55 rad out from the vertical. Each lame is eight-sided with its vertices knocked up to 0.012, a shell 0.035 thick with rims. Ember goes on the rims and inner faces, which show in the step between two lames |
| `slag_brute_Torso` | six chamfered slabs, shingled over the upper back. A top row 0.66 wide behind the neck (y 1.88), two pairs below it (y 1.68 and 1.46) turned round the back, and one 0.48 wide at y 1.26. Each slab's face is turned to the back's slope and lies on it (the back's skin is at z 0.22 to 0.27 between y 1.4 and 1.7; the kit's back reaches z 0.51). Three blunt five-sided knobs lean back on the upper rows. Ember goes on the slabs' undersides and their chamfers, which show between a slab and the one below |
| `slag_brute_WeaponPivot` | three chamfered slabs stacked along the club's axis at 0.33, 0.46 and 0.595 of it. They are 0.52 to 0.64 across, with the lowest the widest, over the spikes' tips, and 0.64 to 0.76 fore and aft, with the lowest the shortest. Each is turned 0.05 to 0.12 rad about the axis so the edges stagger, and its corners are knocked up to 0.03. The club's head, its two straps and its six spikes (out to 0.28 from the axis between 0.45 and 0.60 of it) sit inside, as measured below. Ember goes only on the seams between the slabs. The top slab's upper face, where the handle goes in, stays crust, and so does the lowest slab's end face, which faces the camera in the Overhead Slam |

- **One material.** Every piece is on `mat_bone_hill_giant_paint`, the giant's own plain material, so the colours are painted as they are with no tile mean. The file stays at 34 materials. Every kit primitive carries `COLOR_0`, and the manifest lists `Kit_slag_brute` as its own `all` unit. UV layers are dropped.
- **Faceted.** Every piece is flat-shaded, with `_goblin_tint`'s plane tones on the basalt and the crust.
- **A builder fix found on the first sheets.** The slabs at first rendered with their ember on top. `_slag_chunk` moved the cube's vertices and left stale face normals, and `finalize_obj`'s `recalc_face_normals` then turned the boxes inside out. `bm.normal_update()` before `finalize_obj` fixes this. Measured on the built file, 118 of the maul's 132 triangles now face away from its centre, against 13 before. The ember-coloured corners have a mean normal y of −0.71 on the back slabs, so they are undersides.
- **Budget**: 934 of the 1,200 triangles allowed, 4 meshes, 1 material. The builder stops over 1,200.
- **The fix round (`MK2 fix`).** It made three changes:
  - **Spikes inside the maul.** `scratch/mk2/inside.mjs` tests every vertex of the giant's club and of its bone mesh past 0.25 of the club's axis against the three slabs, from the builder's numbers with the chamfer and without the jitter. It found 25 of 967 outside in the first build: the tip of the spike that points along the slab's width at 0.60 of the axis, 0.28 out, against the lowest slab's 0.27. That slab is now 0.64 across, and 0 of 967 are outside.
  - **No ember square in the Slam.** The lowest slab's end face was ember, and the Slam turns it to the camera. Ember now goes only on the seams.
  - **Plates on the back.** The back's middle and lower rows and their two knobs stood about 0.1 off the back, with ember showing in the gap from the side. They are 0.07 further in.

## Values

The checks are design 5.4 and 5.6, measured as MK1's are: Rec. 601 luma and HSV value.

| Colour | Luma | HSV value |
|---|---|---|
| Kit basalt `0x4A4440` (plates) | 27% | 29% |
| Kit crust `0x5C5550` (maul, knobs) | 34% | 36% |
| Kit ember `0xBC5C28` (seams) | 45% | 74% |
| Giant skin `0xA8805E` | 53% | 66% |
| Giant pelt `0x6E4E32` | 33% | 43% |

| Rule | Result |
|---|---|
| 5.4 range 25% to 75% (HSV value) | met: basalt 29%, crust 36%, ember 74% |
| 5.4 floor 18% | met: the darkest kit paint is the basalt at 27% luma |
| 5.4 at most one emissive, at most five materials | no emissive on the figure; one material in the kit |
| 5.6.1 a silhouette element that survives 85 px | met (`mk2-brute-silhouette.jpg`). From the front and back, the shoulders widen into two plated domes. From the side, the hump stands behind the back with its knobs. In every view the club's thin spiked head becomes a square block at the right hand |
| 5.6.2 value 15 points from the base | the figure's value is set by the row's tint, which is D4's (item 1). Piece against piece, the plates are 26 points of luma under the giant's skin (27 against 53) |
| 5.6.3 size | the content file's `modelScale` 1.12 (D4's row) |

## Measured

`node scratch/mk2/stats.mjs` (MK1's). "Packed" is `packGlb` (`node scratch/mk2/pack.mjs`).

| | As exported | Packed |
|---|---|---|
| Kit triangles / meshes / materials | 934 / 4 / 1 | same |
| Kit raw bytes | 61,572 | 40,584 |
| Kit Brotli bytes | 18,600 | 14,635 |
| File raw / Brotli | 3,816,712 / 1,544,224 | 2,334,268 / 949,695 |
| File meshes / materials / triangles | 54 / 34 / 61,044 | same |

The packed kit is 14.6 kB against the 20 kB kit ceiling.

World bounds of the pieces at rest (figure space, from the placement test below):

| Piece | x | y | z |
|---|---|---|---|
| Left pauldron | −0.89 to −0.35 | 1.46 to 1.87 | −0.33 to 0.29 |
| Right pauldron | 0.34 to 0.90 | 1.45 to 1.88 | −0.34 to 0.28 |
| Back | −0.44 to 0.43 | 1.14 to 2.07 | 0.12 to 0.51 |
| Maul head | 0.68 to 1.42 | 0.011 to 0.54 | −0.64 to 0.18 |

**Untouched figures**: compared with MK1's build (`scratch/models-build/mk1b`, the same builder without this task), the primitive hashes of all 14 roots are identical: every `Monster_` figure, `hill_giant` among them, and the three other kits. Only `slag_brute` is new.

## Pending manifest and COMPARE

`python3 scratch/mk2/make_pending.py` loads the pending manifest MK1 wrote and adds the following, with nothing else changed:
- `nodes`: `Kit_slag_brute` (no parent) and `slag_brute_Torso`, `_LeftArmPivot`, `_RightArmPivot` and `_WeaponPivot` (parent `Kit_slag_brute`). Each child's bare name is asserted to be a `hill_giant_` bone. All are at translation 0 and scale 1.
- `meshClasses`: `^slag_brute_(Torso|LeftArmPivot|RightArmPivot|WeaponPivot)$`.
- `vertexColor.figures.Kit_slag_brute`: `all`.
- `figures.Kit_slag_brute`: 1,200 triangles, 4 meshes, 3 materials, raw 40,584 (packed), Brotli 20,000. These are the kit row of final.md item 6, as for MK1.
- File `budget`: only the ceilings the packed build exceeds rise, to `buildManifest`'s numbers for it:
  - triangles from 60,110 to 61,044;
  - meshes from 50 to 54;
  - raw bytes from 2,312,929 to 2,357,611.

  Brotli stays 1,270,000 and materials stay 34.

No figure's ceiling moved. The materials and the clips are asserted unchanged.

| COMPARE | Exit | Result |
|---|---|---|
| This build, packed (`node scripts/models-compare.mjs scratch/models-build/mk2-packed/monsters.glb public/models/monsters.glb`), against the pending manifest | **0** | Contract and Budget pass. Drift lists MK1's renamed and new kit nodes, and also lists the following:<ul><li>the five new `slag_brute` nodes and four meshes;</li><li>`goblin_body` and `goblin_archer_body` changing bytes, as in MK1's base build;</li><li>file triangles 59,274 to 61,044 and Brotli 920,877 to 949,695.</li></ul> |
| This build, as exported | 2 | Budget only (26 lines), on the packed ceilings, as for MK1, K1 and K2. Contract passes |

## Checks

**On the branch at the fix commit:**

| Check | Command | Result |
|---|---|---|
| `ONE` | `flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run tests/monster-models.test.ts` | exit 0: 19 passed |
| `SUITE` | `flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run` | exit 0: 130 files passed; 1,428 passed, 3 skipped |
| `TYPES` | `flock /tmp/claude-capped.lock scripts/capped.sh npx tsc --noEmit` | exit 0, no output |
| `BUILD` | `flock /tmp/claude-capped.lock scripts/capped.sh npm run build` | exit 0. JS chunk 1,097.21 kB (gzip 311.09 kB), CSS 37.73 kB, reported and not a ceiling |
| `UNTOUCHED` | `git status --short public/models blender` | prints nothing |

**Built-file check (`monster-motion`).** Unlike MK1, the packed build was not copied over `public/models/monsters.glb`: that copy was refused, since this lane never writes `public/models` before MP6. Three scratch tests read the build from `scratch/models-build/mk2-packed/monsters.glb`, with the shipped `hero.glb`. They were placed under `tests/` for the run and deleted afterwards:
- `scratch/mk2/motion-built.test.ts`: `tests/monster-motion.test.ts` with only its `monsters` load pointed at the built file;
- `scratch/mk2/libraries-built.test.ts`: `tests/monster-libraries.test.ts`, the same way;
- `scratch/mk2/kit-engine.test.ts`: MK1's placement test for the giant.

`tests/monster-kits.test.ts` reads no model file. It runs as it is.

The command:

```
flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run tests/mk2-motion-built.test.ts tests/mk2-kit-engine.test.ts tests/mk2-libraries-built.test.ts tests/monster-kits.test.ts
```

The result: exit 0, 4 files, 46 passed, 3 skipped.
- `monster-motion` on the built file: 38 passed and 3 skipped. The giant's row plays the biped library from the built file.
- `monster-libraries` on the built file: 2 passed.
- `monster-kits`: 6 passed.
- The placement test: 3 passed. It loads the built file through `GLTFLoader` and `upgradeMonsterRigWithGltf` on the `hill_giant` row with `kit: 'slag_brute'`, moves each `slag_brute_<Bone>` piece under `<Bone>` (MP6's rule, by hand), and checks these points:
  - all four pieces find their bone, through `getObjectByName` and `PropertyBinding.findNode`;
  - no rig pivot is a kit mesh;
  - each piece's world bounds equal its own bounds moved by its joint, within 1e-4;
  - every piece has `vertexColors` and none is emissive;
  - turning `RightArmPivot`, `LeftArmPivot` or `Torso` by 0.8 turns the pieces on it by 0.8 (the right pauldron and the maul on the right arm);
  - the row's motion (`biped`: `Idle`, `Walk`, `Slash`, `Death`), played through `poseMonsterLimbs` for 15 walk frames, turns a leg bone and moves a kit piece, and the attack moves the maul;
  - without the kit field, no piece is added.

The first run of the placement test failed one check: it measured a pauldron's centre travel, which is small because the piece is centred on its joint (0.07 against 0.1). It now checks the piece's world turn, and all three pass.

## Sheets

`scratch/mk2/kit_render.py` is MK1's script, not committed. It parents each child to the giant bone its name gives, at the bone's rest joint. The run exits 0:

```
flock /tmp/claude-blender.lock timeout 600 /usr/bin/blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python scratch/mk2/kit_render.py -- scratch/models-build/mk2/monsters.glb scratch/mk2/sheets
```

| Sheet | What it shows |
|---|---|
| `mk2-brute-turnaround.jpg` | the brute in `review_render`'s turnaround: front three-quarter, side and back three-quarter, 512 px, 426 px tall |
| `mk2-brute-worst-pose.jpg` | the brute in `review_render`'s worst pose: crouch, right arm overhead, trunk twisted, head turned. The maul is raised like a sledge, the right pauldron turns with the arm round the shoulder, and the back plates stay on the twisted trunk |
| `mk2-brute-silhouette.jpg` | **the 85 px silhouette sheet**: black cut-outs at distance 26 in a 1080 frame, in pairs of giant then brute, from the front, three-quarter, side and back. The giant is at its catalog `scale` 1.55, and the brute at 1.736 (× `modelScale` 1.12). Heights in px: front 162 and 183, three-quarter 172 and 196, side 177 and 206, back 161 and 180 |
| `mk2-brute-against.jpg` | lit and untinted, the giant then the brute, at three-quarter, side and back three-quarter |

**Reading the cut-outs:**
- The shoulders end in squared, plated domes wider than the giant's round ones.
- From the side, a hump with knobs stands off the upper back.
- The club's thin spiked head is a square block in every view.
- Nothing rises above the head.

**Reading the lit sheets (side and back judged too):**
- From the front, two dark plated pauldrons with ember lines between the lames. The face, beard and skull buckle are the giant's.
- From the side, the hump of dark slabs lies on the back, and the maul is a block of three dark slabs with ember seams.
- From the back, the shingled slabs cover the upper back between the shoulder blades. The top of the hump is basalt, and the ember shows only under each slab's edge.
- Nothing intersects visibly in the rest views. The hump stands clear of the back of the skull (z 0.14 at most against the plates' 0.30 at y 1.88).
- In the worst pose, the raised maul's top end is crust, with ember only on its two seams.

# MK3: Marrowjaw's kit on the hill giant

Built from `5031e36` plus this task's builder (commit `feat(models-s6c): MK3`), with `BLEND(monsters)` on Blender 5.0.1:

```
flock /tmp/claude-blender.lock timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs monsters --out scratch/models-build/mk3
```

The build exits 0 and prints `[Blender] marrowjaw kit: 1150 triangles in 4 pieces`. It is packed as `scratch/models-build/mk3-packed`. Every number, sheet and check below comes from that build.

Nothing is promoted: `git status --short public/models blender` prints nothing. The built-file checks read the scratch file directly. MP6 promotes the file and makes the amendment's loader change. D4 gives the row `kit: 'marrowjaw'` and its tint.

## Open for the main session

1. **The row's tint multiplies the whole kit.** The engine multiplies every non-glow material by the row's `tint`, kit pieces included, as for MK2. The content file's `tintNote` is "war paint, iron collar", and the row has no hex value yet. A warm or dark tint darkens the bone crown, the ribs and the banner together. The sheets are untinted.
2. **"Iron collar" and body war paint are not in MK3's list.** The plan asks for bone shoulder armour, a jaw-bone crown and a toll banner pole. The war paint here is only on the kit (the middle rib of each pauldron and the crown's two hinges). The kit has all four meshes, so a collar would need a fifth mesh or a place on one of the four pieces (it could join `_Torso`). That is the owner's call, not a defect.
3. **No emissive on the figure.** The giant has none and the kit adds none, so design 5.4's "at most one" holds.
4. **Pieces that sink into the body at rest**, measured by `scratch/mk3/inside.mjs` (rays along z through each kit vertex against the giant's skinned meshes at rest):
   - the crown: 16 of 927 vertices, at most 0.050 deep, where the hinges meet the back of the skull;
   - the pauldrons: 42 and 46 of 402, at most 0.075, the rib ends tucked into the chest and the shoulder blade;
   - the banner piece: 19 of 553, at most 0.020, where the pole lies on the back.

   None shows in the sheets as a visible cut.
5. **Not seen in the engine.** MK3's accept has no capture. MP6's capture should look at three things:
   - the outline pass on the thin banner, which is 0.02 thick;
   - the pole in `Death`;
   - the banner against the camera's orbit, since it is edge-on at about 40 degrees from the front.

## What was built

`build_marrowjaw_kit` is called in `main()` after `build_slag_brute_kit`. It goes through `_kit_root` with `giant_joints()`. Every child is named `marrowjaw_<Bone>` (amendment). No other builder changed. The primitive hashes of all 15 roots match MK2's build (`scratch/models-build/mk2`), and only `marrowjaw` is new.

| Child (bone) | What it is |
|---|---|
| `marrowjaw_HeadGroup` | a beast's lower jaw worn as a crown. A horseshoe band 0.03 by 0.045 at y 2.27, open at the back, with radii 0.200 across and 0.222 fore and aft about three z −0.08. On the built giant the skull there is 0.31 across and 0.36 deep, so the band rests on the crown of the skull, above the brow and the ears. Eight four-sided teeth stand on it, the canines at the front corners the tallest (0.17). The jaw's two hinges rise 0.2 at the back, lean out, are war-painted, and end in a bone knuckle |
| `marrowjaw_LeftArmPivot`, `marrowjaw_RightArmPivot` | three ribs over each shoulder ball, which has radius 0.20 at the arm's joint. The ribs lie in planes across the arm at −0.06, 0.04 and 0.13 along it. Each arches from the chest over the top to the shoulder blade, 0.05 clear of the ball. The middle rib is war-painted and the other two are older bone. One five-sided tusk 0.34 long rises from the top, up, back and a little out. All of it is centred on the arm's joint, so it turns with the arm |
| `marrowjaw_Torso` | the toll banner. The pole is at x −0.16, three z 0.335. It sits in a hide socket at the belt, with one hide binding at y 1.3, and is tucked under the giant's fur strap at y 1.55. It rises to a brass cap at y 3.36. A cross-bar at y 3.12 is turned 35 degrees back from the figure's left. The banner hangs from it: 0.46 wide, 0.70 deep, swallow-tailed, two-sided (0.02 thick), slightly waved. A brass toll coin sits on each face |

- **One material.** Every piece is on `mat_bone_hill_giant_paint`, the giant's own plain material, so the colours are painted as they are. The file stays at 34 materials. Every kit primitive carries `COLOR_0`, and the manifest lists `Kit_marrowjaw` as its own `all` unit.
- **Faceted.** Every piece is flat-shaded, with `_goblin_tint`'s plane tones.
- **The pole on the back**, measured with rays at x −0.16:
  - the back's skin is at three z 0.27 to 0.30 between y 0.95 and 1.35, and the pole's surface at 0.299 lies on it (gaps −0.005 to 0.021);
  - at y 1.55 the fur strap (0.315) passes over the pole;
  - above y 1.6 the back falls away, and the pole stands free behind the head, whose back is at z 0.14 at most.
- **Budget**: 1,150 of the 1,200 triangles allowed, 4 meshes, 1 material.

## Values

Rec. 601 luma and HSV value, as for MK1 and MK2.

| Colour | Luma | HSV value |
|---|---|---|
| Bone `0xBCAC8C` (jaw, teeth, tusks; the giant's own bone) | 68% | 74% |
| Old bone `0xA49474` (two ribs of three) | 58% | 64% |
| War paint `0x8C3424` (middle ribs, hinges) | 30% | 55% |
| Banner `0x7A2C22` | 26% | 48% |
| Wood `0x6E5034` (pole, cross-bar; the club's) | 34% | 43% |
| Hide `0x6E4E32` (socket, binding; the pelt's) | 33% | 43% |
| Brass `0xB08C3C` (coins, cap) | 56% | 69% |

| Rule | Result |
|---|---|
| 5.4 range 25% to 75% (HSV value) | met: 43% to 74% |
| 5.4 floor 18% | met: the darkest kit paint is the banner at 26% luma |
| 5.4 at most one emissive, at most five materials | no emissive on the figure; one material in the kit |
| 5.6.1 a silhouette element that survives 85 px, and reading apart from MK2 | met (`mk3-marrowjaw-silhouette.jpg`). In every view the banner and pole stand above the head, at 289 to 324 px tall against the brute's 180 to 206 px. The crown's teeth and hinges notch the head's outline, and the two tusks break the shoulders into spikes. The brute is low and wide, with squared shoulder domes, a back hump, nothing above the skull and a square maul block at the right hand. Marrowjaw is vertical and spiked, and keeps the giant's thin spiked club |
| 5.6.2 value 15 points from the base | set by the row's tint, which is D4's (item 1) |
| 5.6.3 size | the content file's `modelScale` 1.3 (D4's row) |

## Measured

`node scratch/mk3/stats.mjs` (MK1's). "Packed" is `packGlb` (`node scratch/mk3/pack.mjs`).

| | As exported | Packed |
|---|---|---|
| Kit triangles / meshes / materials | 1,150 / 4 / 1 | same |
| Kit raw bytes | 79,988 | 52,580 |
| Kit Brotli bytes | 20,541 | 16,621 |
| File raw / Brotli | 3,900,212 / 1,565,203 | 2,390,492 / 968,131 |
| File meshes / materials | 58 / 34 | same |

The packed kit is 16.6 kB against the 20 kB kit ceiling.

## Pending manifest and COMPARE

`python3 scratch/mk3/make_pending.py` (MK2's, for this kit) loads the pending manifest MK2 wrote and adds the following, with nothing else changed:
- `nodes`: `Kit_marrowjaw` and `marrowjaw_HeadGroup`, `_LeftArmPivot`, `_RightArmPivot` and `_Torso`, each asserted to be a `hill_giant_` bone;
- `meshClasses`: `^marrowjaw_(HeadGroup|LeftArmPivot|RightArmPivot|Torso)$`;
- `vertexColor.figures.Kit_marrowjaw`: `all`;
- `figures.Kit_marrowjaw`: 1,200 triangles, 4 meshes, 3 materials, raw 52,580 (packed), Brotli 20,000;
- file `budget`: only the ceilings the packed build exceeds rise. Triangles go from 61,044 to 62,194, meshes from 54 to 58, and raw bytes from 2,357,611 to 2,414,397. Brotli stays 1,270,000 and materials stay 34.

| COMPARE | Exit | Result |
|---|---|---|
| This build, packed (`node scripts/models-compare.mjs scratch/models-build/mk3-packed/monsters.glb public/models/monsters.glb`), against the pending manifest | **0** | "All contract checks passed", "All budget checks passed". Drift lists the earlier kits' nodes, the five new `marrowjaw` nodes and four meshes, triangles 59,274 to 62,194 and Brotli 920,877 to 968,131 |
| This build, as exported | 2 | Budget only, on the packed ceilings, as for MK1 and MK2. Contract passes |

## Checks

**On the branch at the feat commit:**

| Check | Command | Result |
|---|---|---|
| `ONE` | `flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run tests/monster-models.test.ts` | exit 0: 19 passed |
| `SUITE` | `flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run` | exit 0: 130 files passed; 1,428 passed, 3 skipped |
| `TYPES` | `flock /tmp/claude-capped.lock scripts/capped.sh npx tsc --noEmit` | exit 0, no output |
| `BUILD` | `flock /tmp/claude-capped.lock scripts/capped.sh npm run build` | exit 0. JS chunk 1,097.21 kB (gzip 311.09 kB), CSS 37.73 kB, reported and not a ceiling |
| `UNTOUCHED` | `git status --short public/models blender` | prints nothing |

**Built-file check (`monster-motion`).** As for MK2, three scratch tests read `scratch/models-build/mk3-packed/monsters.glb` with the shipped `hero.glb`. They were placed under `tests/` for the run and deleted afterwards:
- `motion-built`: `tests/monster-motion.test.ts` with only its `monsters` load pointed at the built file;
- `libraries-built`: `tests/monster-libraries.test.ts`, the same way;
- `kit-engine`: MK2's placement test for `kit: 'marrowjaw'`, with its four bones.

The command:

```
flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run tests/mk3-motion-built.test.ts tests/mk3-kit-engine.test.ts tests/mk3-libraries-built.test.ts tests/monster-kits.test.ts
```

The result: exit 0, 4 files, 46 passed, 3 skipped.
- `monster-motion` on the built file: 38 passed and 3 skipped.
- `monster-libraries` on the built file: 2 passed.
- `monster-kits`: 6 passed.
- The placement test: 3 passed. The kit is loaded through `upgradeMonsterRigWithGltf` on the `hill_giant` row with `kit: 'marrowjaw'`, and each `marrowjaw_<Bone>` is moved under `<Bone>` (MP6's rule, by hand). It checks:
  - all four pieces find their bone;
  - no rig pivot is a kit mesh;
  - each piece's world bounds equal its own bounds moved by its joint, within 1e-4;
  - every piece has `vertexColors` and none is emissive;
  - turning `RightArmPivot`, `LeftArmPivot`, `Torso` or `HeadGroup` by 0.8 turns the piece on it by 0.8;
  - the giant's biped motion turns a leg bone and moves a kit piece in 15 walk frames, and the attack moves the right pauldron;
  - without the kit field, no piece is added.

## Sheets

`scratch/mk3/kit_render.py` is MK2's script, not committed. It mounts both the brute's and Marrowjaw's kits on the giant's bones at their rest joints and shows one kit at a time. The run exits 0:

```
flock /tmp/claude-blender.lock timeout 600 /usr/bin/blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python scratch/mk3/kit_render.py -- scratch/models-build/mk3/monsters.glb scratch/mk3/sheets
```

| Sheet | What it shows |
|---|---|
| `mk3-marrowjaw-turnaround.jpg` | Marrowjaw in `review_render`'s turnaround: front three-quarter, side and back three-quarter, 512 px, 426 px tall |
| `mk3-marrowjaw-worst-pose.jpg` | the worst pose: crouch, right arm overhead, trunk twisted, head turned. The club is raised on the right, and the banner stays on the left, clear of it. The right pauldron's tusk points out from the raised arm, away from the head and the crown |
| `mk3-marrowjaw-silhouette.jpg` | **the 85 px silhouette sheet**: black cut-outs at distance 26 in a 1080 frame, in triples of giant, brute and Marrowjaw, from the front, three-quarter, side and back. The scales are 1.55, 1.736 (× 1.12) and 2.015 (× 1.3). Heights in px: front 162, 183 and 305; three-quarter 172, 196 and 322; side 177, 206 and 324; back 161, 180 and 289 |
| `mk3-marrowjaw-against.jpg` | lit and untinted: the giant, the brute and Marrowjaw at three-quarter, side and back three-quarter |

**Reading the cut-outs.** Marrowjaw is the tallest of the three by the banner alone. A flag stands above the left shoulder in every view, and the crown and its hinges notch the top of the head. Two spikes break the shoulder line. Nothing of the brute's low, squared outline (plated domes, hump, maul block) is shared.

**Reading the lit sheets (side and back judged too).**
- From the front, the pale jaw crown sits on the skull with its teeth up, and the two red hinges stand behind it. The ribs arch over each shoulder, the middle one red, with a tusk rising.
- From the side, the banner shows its face and coin, and the pole runs down the back into the socket at the belt.
- From the back, the pole lies on the back under the fur strap, and the banner hangs to the left of the head.
- No visible intersection in the rest views.

# MB1: Matron Saltfang's body on the crawler skeleton

Built from `9e91183` plus this task's builder (commit `feat(models-s6c): MB1`), with `BLEND(monsters)` on Blender 5.0.1:

```
flock /tmp/claude-blender.lock timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs monsters --out scratch/models-build/mb1
```

The build exits 0 and prints `[Blender] saltfang: 7842 triangles in 3 meshes; width 2.818, height 2.029, length 3.226; lowest -0.0091`. It is packed as `scratch/models-build/mb1-packed`. Every number, sheet and check below comes from that build.

Nothing is promoted: `git status --short public/models blender` prints nothing. MP6 promotes the file. Z4 gives the row `body: 'saltfang'` and its tint.

## Open for the main session

1. **The row's tint.** The content file gives `tintNote: 'salt-white shell, violet sting'` and no hex value. The engine multiplies the tint into every material but the glow, so a dark or warm tint greys the salt carapace and the eggs together. The sheets are untinted. A light tint, or none, keeps the salt white.
2. **She floats a little in the middle of `Death`.** She plays the scorpion's library, and its `Hips` track is locked to the scorpion's lowest point frame by frame. Measured on the built file through the real loader (13 samples a clip, lowest skinned vertex):

   | Clip | Saltfang's lowest point | The scorpion's | Largest gap in one frame |
   |---|---|---|---|
   | `Idle` | −0.004 to −0.002 | −0.000 to 0.000 | 0.004 |
   | `Walk` | −0.010 to 0.005 | −0.004 to 0.007 | 0.006 |
   | `Strike` | −0.007 to −0.002 | −0.000 to 0.000 | 0.007 |
   | `Death` | −0.002 to 0.058 | −0.000 to 0.009 | 0.058 |

   - In `Death`, the gap is in the falling frames (about 0.45 to 0.65 of the clip). Her longer legs lift higher than the scorpion's, so her lowest point is a front tarsus 0.058 above the ground. At modelScale 2.2 that is about 0.13 for a few frames of the fall. The final pose rests on the ground (0.002).
   - The first build sank 0.043 at the end of `Death`: the sagging left claw's outer pincer went through the ground. The pincers were shortened to the scorpion's reach from the elbow, and the forearm end, chela, claw crystals and pincers were raised by 0.025. The figures above are from the build after that fix.
   - If the owner sees the float in the game, there are two exits: shorter legs (a narrower stance), or a `Death` of her own (clips of her own, which the plan does not list).
3. **Brood mechanic.** Design 7.7 and CALL-6.22 leave a brood (eggs or hatchlings to deal with) for the models pass. The egg sacs are only a look: two piles of ten eggs on her back, with no node of their own. If a brood is added later, the eggs could become their own mesh or node.
4. **`scripts/blender/review_scales.json` has no `saltfang` entry.** `review_render.py` refuses a figure without one. The sheets here use a scratch copy of the renderer with `saltfang: 2.2` added. That file is not in MB1's list. MP6, or the task that renders the roster next, should add the entry.
5. **`tests/fixtures/monster-families.json`** has no `saltfang` entry, and `tests/monster-merge.test.ts` reads the shipped file. Her family triangle counts for the promote step: `skin` (`saltfang_body`), `plain` (`saltfang_shell`) and `glow` (`saltfang_sting`), 7,842 triangles in all. Read the per-family split off the built file at MP6.
6. **Emissive.** Only the sting and eyes are emissive, on the file's `mat_glow_purple`, so design 5.4's "at most one" holds.
7. **Not seen in the engine.** MB1's accept has no capture. MP6's capture should look at three things:
   - the sting's violet against the cave's light;
   - the egg piles at the game's camera angle;
   - the `Death` fall (item 2).

## What was built

`build_saltfang` is called in `main()` after `build_saltback_stalker_kit`.
- **Rig.** `figkit.make_rig("Monster_saltfang", rigs.CRAWLER_TABLE, scorpion_joints(), prefix="saltfang")`: the scorpion's 20 bones at the scorpion's joints, named `saltfang_<Bone>`. It has no clips. The engine strips the prefix (`stripBonePrefix`) and plays the `scorpion_` library on the model key `scorpion`, as it plays the dragon's on Ashmantle.
- **Weights.** Every part is hard on one bone, as on the scorpion. The builder stops if any of the 19 bones in `SCORPION_BONES` holds no part, and none does.
- **No other figure changed.** The primitive hashes of all 16 earlier roots match MK3's build (`scratch/models-build/mk3`).

| Part | Bone | What it is |
|---|---|---|
| Prosoma | `HeadGroup` | a faceted salt-white lathe, 0.96 across at its back (the scorpion's is 0.80), with three salt crystals over the brow, six violet eyes, and two bone mandibles |
| Brood body | `Hips` | six faceted salt plates from z −0.40 to 0.91, at half-widths 0.48, 0.54, 0.58, 0.60, 0.54 and 0.40 (the scorpion's widest is 0.45), widest behind the legs and floored at y 0.31, the scorpion's. Each plate's rim has two crystals a side, leaning out |
| Egg sacs | `Hips` | two piles of ten eggs (radii 0.075 to 0.115), at x ±0.18 to ±0.42, set on the plates' top by rays. They are clear of the midline the tail passes over in `Strike`. The larger eggs are pale violet grey, and the smaller ones darker |
| Tail | `TailPivot`, `TailPivot2`, `TailPivot3` | the scorpion's path, its radii times 1.25, in faceted salt segments with chitin rings |
| Sting | `TailPivot3` | a swollen chitin telson, and two violet prongs (base 0.095, length 0.50) splayed from its sides: the fork |
| Legs | `LeftLegPivot`, `RightLegPivot` (coxae); `LegL1` to `LegR4` | the scorpion's joints and fans, but longer. The knee is 0.30 out and 0.26 up, and the tip is 0.78 out on the ground (the scorpion's is 0.58), so the stance is 0.4 wider. The legs are thicker, with a ring at each joint and the tarsi in bone |
| Claws | `LeftArmPivot`, `RightArmPivot`; `LeftElbowPivot`, `RightElbowPivot` | a thicker pedipalp and forearm. The chela is faceted (0.19 × 0.15 × 0.27, against the scorpion's 0.15 × 0.12 × 0.21), with three salt crystals on top. The two bone pincers are no longer from the elbow than the scorpion's (item 2) |

- **Meshes.** There are three skinned meshes, `saltfang_body` (skin, `mat_skin_saltfang_paint`), `saltfang_shell` (plain, `mat_bone_saltfang_paint`) and `saltfang_sting` (glow, `mat_glow_purple`). The file has two new materials, 36 in all. No mesh name holds `eye`.
- **Paint.** The paint is a corner colour on white materials (pattern step 6), with plane tones on the faceted parts, and `bake_paint` occlusion at 0.5.
  - The chitin is painted as its colour over the scorpion-chitin tile's mean, linear 0.9033 0.6858 0.3765. The engine draws `skin` with that tile because the row's model key is `scorpion`.
  - Salt-white cannot be painted over that ochre tile, since the paint would exceed 1. So the salt, the bone and the eggs are on the plain material and painted as they are.
  - As with the goblin, the renderer has no tile, so the chitin shows grey-blue in the sheets.
- **Budget.** The builder's own budget is 9,000 triangles, and the manifest's is 14,000.

## Values

Rec. 601 luma and HSV value.

| Colour | Luma | HSV value |
|---|---|---|
| Salt `0xB9B1A2` (plates, prosoma, tail segments) | 70% | 73% |
| Crystal `0xBFBBB1` | 73% | 75% |
| Bone `0xAEA287` (pincers, mandibles, tarsi) | 64% | 68% |
| Egg `0x9D8FA6` | 59% | 65% |
| Egg, dark `0x83758D` | 49% | 55% |
| Chitin `0x6A5741` (femurs, claws, pedipalps) | 35% | 42% |
| Chitin, dark `0x4E4030` (tibiae, forearms, telson) | 26% | 31% |
| Ring `0x3F3326` (joint rings, coxae) | 21% | 25% |

| Rule | Result |
|---|---|
| 5.4 range 25% to 75% (HSV value) | met: 25% to 75% |
| 5.4 floor 18% | met: the darkest paint is the rings at 21% luma |
| 5.4 at most five materials, one emissive | three materials; one emissive (the sting and eyes) |
| 5.6 a different black cut-out at 85 px (as for Ashmantle) | met (`mb1-saltfang-silhouette.jpg`). From the front she is a low wide dome with two humps on the back and splayed legs, against the scorpion's narrow body. From the side her egg piles break the back line, and her heavy fork is visible. The stalker's crystal ridge runs along the midline instead |
| 5.6.2 value 15 points from the base | met. Her main area is the salt at 73%, against the scorpion's ochre shell at 52% (`0x84582A`) |
| 5.6.3 size | the content file's `modelScale` 2.2 |

## Measured

`node scratch/mb1/stats.mjs` (MK3's). "Packed" is `packGlb` (`node scratch/mb1/pack.mjs`).

| | As exported | Packed |
|---|---|---|
| Saltfang triangles / meshes / materials / vertices | 7,842 / 3 / 3 / 8,871 | same |
| Saltfang raw bytes | 509,624 | 296,720 |
| **Saltfang Brotli bytes** | 138,400 | **97,479** |
| Width, height, length | 2.818, 2.029, 3.226 (scorpion 2.423, 1.987, 3.191) | |
| File raw / Brotli | 4,414,652 / 1,701,909 | 2,692,188 / 1,058,485 |
| File meshes / materials | 61 / 36 | same |

The packed figure is 97.5 kB against the boss class's 220 kB. The height is 2.1% over the scorpion's, under the builder's 5% check. File Brotli rose from 968,131 to 1,058,485 packed, under the ceiling of 1,270,000.

## Pending manifest and COMPARE

`python3 scratch/mb1/make_pending.py` loads the pending manifest MK3 wrote and adds the following, with nothing else changed:
- `nodes`: `Monster_saltfang` at the origin;
- `skin.bones`: the scorpion's 20 bones renamed `saltfang_`, each checked against the built file's node (parent and translation);
- `skin.skinnedRoots`: `Monster_saltfang`;
- `skin.limbs`: the scorpion's 8 limbs, renamed;
- `materials`: `mat_bone_saltfang_paint` and `mat_skin_saltfang_paint`;
- `meshClasses`: `^saltfang_body$`, `^saltfang_shell$` and `^saltfang_sting$`;
- `vertexColor.figures.Monster_saltfang`: `all`;
- `figures.Monster_saltfang`: 14,000 triangles, 4 meshes, 5 materials, raw 296,720 (packed), Brotli 220,000;
- file `budget`: only the ceilings the packed build exceeds rise. Triangles go from 62,194 to 70,036, meshes from 58 to 61, materials from 34 to 36, and raw bytes from 2,414,397 to 2,719,110. Brotli stays 1,270,000.

`clips` is unchanged: the generated clip list equals MK3's.

| COMPARE | Exit | Result |
|---|---|---|
| This build, packed (`node scripts/models-compare.mjs scratch/models-build/mb1-packed/monsters.glb public/models/monsters.glb`), against the pending manifest | **0** | "All contract checks passed", "All budget checks passed". Drift lists the earlier kits' nodes and Saltfang's 21 nodes and 3 meshes |
| This build, as exported | 2 | Budget only, on the packed ceilings, as for MK1 to MK3. Contract passes |

## Checks

**On the branch at the feat commit:**

| Check | Command | Result |
|---|---|---|
| `SUITE` | `flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run` | exit 0: 130 files passed; 1,428 passed, 3 skipped |
| `TYPES` | `flock /tmp/claude-capped.lock scripts/capped.sh npx tsc --noEmit` | exit 0, no output |
| `BUILD` | `flock /tmp/claude-capped.lock scripts/capped.sh npm run build` | exit 0. JS chunk 1,097.21 kB (gzip 311.09 kB), CSS 37.73 kB, reported and not a ceiling |
| `UNTOUCHED` | `git status --short public/models blender` | prints nothing |

**Built-file check (`monster-motion`).** Three scratch tests read `scratch/models-build/mb1-packed/monsters.glb` with the shipped `hero.glb`. They were placed under `tests/` for the run and deleted afterwards; copies are in `scratch/mb1/`.
- `mb1-motion-built`: `tests/monster-motion.test.ts`, with only its `monsters` load pointed at the built file.
- `mb1-libraries-built`: `tests/monster-libraries.test.ts`, the same way.
- `mb1-saltfang-engine`: Ashmantle's motion case, made for Saltfang. It loads through `upgradeMonsterRigWithGltf` on the `scorpion` row with `body: 'saltfang'`, and checks:
  - `saltfang_body`, `_shell` and `_sting` are present, and `scorpion_body` is absent;
  - each of the 19 bones in `MONSTER_MOTION.scorpion.bones` carries weight on her skin;
  - the animator has `Idle`, `Walk`, `Strike` and `Death`;
  - `Walk` plays and turns `LegL1`;
  - a plain attack plays `Strike` and turns `TailPivot3`;
  - it prints the lowest-point table above.

The command:

```
flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run tests/mb1-saltfang-engine.test.ts tests/mb1-motion-built.test.ts tests/mb1-libraries-built.test.ts tests/monster-kits.test.ts
```

The result: exit 0, 4 files, 46 passed, 3 skipped.
- `mb1-libraries-built`: 2 passed.
- `mb1-motion-built`: 38 passed, 3 skipped.
- `mb1-saltfang-engine`: 3 passed.
- `monster-kits`: 6 passed.

## Sheets

`scratch/mb1/render/mb1_render.py` is a scratch script and is not committed. It runs on a scratch copy of `review_render.py` with `saltfang: 2.2` in its scales (item 4). It mounts `Kit_saltback_stalker` on the scorpion's bones at their rest joints for the stalker. The run exits 0:

```
flock /tmp/claude-blender.lock timeout 600 /usr/bin/blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python scratch/mb1/render/mb1_render.py -- scratch/models-build/mb1/monsters.glb scratch/mb1/sheets
```

| Sheet | What it shows |
|---|---|
| `mb1-saltfang-turnaround.jpg` | Saltfang in `review_render`'s turnaround: front three-quarter, side and back three-quarter, 512 px, 401 px tall |
| `mb1-saltfang-worst-pose.jpg` | the renderer's worst pose. Every part is rigid on one bone, so nothing tears. The parts follow their bones |
| `mb1-saltfang-silhouette.jpg` | **the 85 px silhouette sheet**: black cut-outs at distance 26 in a 1080 frame, in triples of scorpion, Saltback Stalker and Saltfang, at scales 1.05, 1.47 and 2.31 (scorpion `scale` 1.05 times each `modelScale`; Saltfang's `scale` assumed 1.05, as a scorpion kind). Each triple is shown from the front, three-quarter, side and back. Heights in px: front 98, 137 and 218; three-quarter 106, 149 and 244; side 108, 152 and 253; back 102, 145 and 236. Widths in px: front 112, 156 and 278 |
| `mb1-saltfang-against.jpg` | lit and untinted, at one size: the scorpion, the stalker and Saltfang at three-quarter, side and back three-quarter |

**Reading the cut-outs.** Against the other two, she is about 1.8 times as wide as she is tall from the front (the scorpion is 1.1 times). She has two humps either side of the tail's root, a domed body and long splayed legs. From the side, the egg piles make a lumpy back line, and the forked sting shows two points. The stalker's outline is a narrow body with a jagged crystal ridge on the midline.

**Reading the lit sheets.** She reads as salt-white over dark chitin legs and claws, where the scorpion and the stalker are brown. The violet fork and the eyes are the only saturated colour. The egg piles show as two violet-grey clusters on the back. The rim crystals break the carapace's edge.
