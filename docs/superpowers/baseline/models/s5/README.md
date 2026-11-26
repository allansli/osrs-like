# Slice 5: M3a, the goblin archer rebuilt and the chicken re-rigged

Built with `BLEND(monsters)` on Blender 5.0.1 from `8b43e48` (`timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs monsters --out scratch/models-build/m3a`, exit 0, 8.5 s). Nothing is promoted: `git status --short public/models blender` prints nothing. M4a promotes.

## What was built

**Goblin archer** (`build_goblin_archer`). It follows the pilot's pattern (`../README.md`). The raider's builder is now `_build_goblin_kin(key, tag, colours, kit)`, and both goblins go through it: the same joints, body graph, belt, weights, merge and paint. Only the kit differs (`_raider_kit`, `_archer_kit`). `Monster_goblin_archer` stands at the origin on the biped rig, with bones `goblin_archer_<Bone>`.

- **Its own head**: the raider's skull with a lighter brow, a longer hooked nose (0.27 long), and ears swept further back (rx 0.48) so they come through the hood. A narrow faceted chin carries two small fangs. The irises and pupils are the raider's.
- **The hood**: a faceted shell (10 sides, 8 rings) in dark brown. It is open in front of the face below the brow's top and hangs down the neck and back to the hump. Its point droops back from the crown.
- **Colour**: skin `0x7C8656` (53% value, ten points over the raider's 43%), hands and feet `0x575E3E`. Hood and loincloth are `0x524436`; belt, bracer and quiver are the raider's leather. Design 5.4: the ranged role is lighter than the brute.
- **Bow**: a recurve bow, hard on `OffhandPivot`, held upright at the left side outside the body outline. The string runs tip to tip behind the bow. String and limbs are at least 0.044 across (design 5.3).
- **Quiver**: a tall faceted leather case on `Torso`, from the hips to above the shoulder on the right of the back, with four pale fletchings.
- **Bracer**: a leather bracer on the bow arm (`LeftElbowPivot`).
- **Meshes**: two, `goblin_archer_body` (skin family) and `goblin_archer_wood` (bow, string, fletchings). They use the raider's white materials `mat_skin_goblin_paint` and `mat_wood_goblin_paint`, so no material is added. The engine tiles the archer with goblin-hide (`speciesKey` goblin), and the skin paint is divided by that tile's mean, as the raider's is.

**Chicken** (`build_chicken`). Kept and re-rigged, design 4.6.

- **Shape and colours**: today's primitives at fewer segments (`CHICKEN_SEGS`), each painted today's material colour. 2,436 triangles in three skinned meshes:
  - `chicken_body`, on `mat_skin_chicken_paint`, drawn with the feather tile;
  - `chicken_comb`, on `mat_cloth_chicken_paint`, drawn with the cloth tile;
  - `chicken_beak`, on `mat_gold_chicken_paint`, drawn plain.

  The family words in the material names are today's. The eyes are dark paint on `chicken_beak`, 0.046 across (0.032 before; design 5.3). No mesh name holds `eye`.
- **Rig**: the biped table with every row flagged `code_posed`, built from a copy inside the builder; `rigs.py` is unchanged. Every part is hard on one bone:
  - body and tail on `Hips`;
  - neck, head, comb, wattles, beak and eyes on `HeadGroup`;
  - each whole leg on `LeftLegPivot` or `RightLegPivot`, at today's (∓0.10, 0.24, 0.04), the same within 0.0001;
  - each wing on `LWing` or `RWing`, hinged at its root (±0.16, 0.42, 0.0).

  The arm bones carry nothing. The manifest lists no chicken limb.
- **Fixed**: today's builder moved only the last 12 vertices of each comb lobe. The shipped comb therefore has a red sliver down to the ground (its bounds reach y −0.038; it shows in `m3a-chicken-against.jpg`, left). Each lobe's own vertices move now.

**Raider refinements** (S3d read, moved to M3a by "Lanes 2 and promotes"):

- **Chest-to-belly step**: the body's planes grow at 30 degrees (`GOBLIN_KIN_SPREAD`; 40 before). The largest plane went from 23.3% to 16.0% of the body's area (52 planes on 2,028 faces). `_goblin_skin` and `_goblin_planes` take the spread as an argument that defaults to `GOBLIN_PLANE_SPREAD`, so the demon, dragon and Ashmantle are unchanged.
- **Paid for in shield segments**: the shield has 12 sides (`GOBLIN_SHIELD_SEGS`; 18 before). Families went from wood 120, iron 308, skin 3,932 to wood 96, iron 284, skin 3,980.
- **The foot**: an instep node rises between heel and toe box, and the toe box is 0.09 across (0.075 before). The archer has the same foot.
- **Thumb**: the thumb already existed since S2d. No other "small item" of the S3d read is written down anywhere (plan, design log and `s1/README.md` were searched), so nothing else was changed.

## Measured

Brotli quality 3, using `figureStats` (`scratch/m3a/stats.mjs`, not committed). The "packed" figures are after `packGlb`, which the promote step runs before COMPARE (Q1).

| | Archer, shipped | Archer, M3a | Chicken, shipped | Chicken, M3a | Raider, shipped | Raider, M3a |
|---|---|---|---|---|---|---|
| Triangles | 6,640 | 4,360 | 4,680 | 2,436 | 4,360 | 4,360 |
| Meshes / materials | 28 / 11 | 2 / 2 | 13 / 6 | 3 / 3 | 3 / 3 | 3 / 3 |
| Figure Brotli, as exported | 75,388 | 117,421 | 54,959 | 34,699 | 113,274 | 113,859 |
| Figure Brotli, packed | 60,553 | 71,695 | 45,330 | 24,775 | 68,172 | 68,538 |
| Height of bounds | 1.885 | 1.867 (−1.0%) | 0.825 | 0.790 (−4.2%; the shipped bounds reach the comb sliver at −0.038; top 0.788 against 0.787) | 1.777 | 1.777 |

Design 9.1 with N-3: ordinary 80 kB, small 42 kB. The archer as exported (117 kB) is over the 115 kB as-exported row; packed it is 72 kB.

**The file, packed**: 3,054,848 raw and 812,801 Brotli bytes (shipped: 3,411,448 and 822,441). Triangles 74,724 → 70,200, meshes 156 → 120, materials 44 → 38. As exported: 4,429,720 raw and 1,250,704 Brotli bytes.

**Untouched figures.** Hashes of every primitive (attributes, indices, material name) against a build of `2955c48` (`scratch/models-build/m3a-base`, whose packed copy is byte-identical to the shipped file) match for the scorpion, wizard, ranger, giant, guardian, demon, dragon and Ashmantle.

## Pending manifest and COMPARE

`tests/fixtures/model-contract/pending/monsters.json` is a copy of the live manifest with the chicken's and the archer's entries replaced whole:

- the old pivots leave `nodes`, and both roots stand at the origin;
- 37 bones join `skin.bones`, and both roots join `skinnedRoots`;
- the archer adds the raider's eleven limbs, prefixed;
- mesh classes and materials follow the built file;
- `vertexColor.figures` adds both figures as `all`.

Ceilings, all from the **packed** build:

| Figure | Triangles / meshes / materials | Raw | Brotli |
|---|---|---|---|
| Archer | 5,000 / 4 / 5 | 150,296 | 73,129 |
| Chicken | 2,500 / 3 / 4 | 52,168 | 25,271 |

The triangles, meshes and materials are design 9.1's class for each figure. Raw is the build plus 1%, Brotli the build plus 2%.

Ceilings moved outside the two figures:

- **Raider**: raw 130,164 and Brotli 69,909, from its rebuilt bytes.
- **Dark ranger's Brotli**: 48,482 → 49,546. Its geometry bytes are identical; the file's new buffer-view order moves its Brotli size 2.2%, the S2 case of the archer.
- **File `budget`**: from the packed build by its margins: triangles 70,200, meshes 120, materials 38, raw 3,085,397, Brotli 820,930.

**COMPARE of the packed build** (`node scripts/models-compare.mjs scratch/models-build/m3a-packed/monsters.glb public/models/monsters.glb`): **exit 0**. Contract and Budget pass. Drift lists only chicken, raider and archer nodes and meshes, plus the file's three totals.

**COMPARE of the as-exported build exits 2** on Budget only: every raw and Brotli ceiling is a packed number since D5. The plan's COMPARE line predates Q1, and the promote step packs before it compares.

## Motion

- **Archer**: the row in `src/data/monsterPoses.ts` names the raider's 13 bones. Its clips (`Idle`, `Walk`, `Ranged`, `Death`, anticipation 0.583333 = the hero manifest's `Ranged`) are staged as `PENDING_ARCHER_CLIPS`, as D2b and M3d did: the shipped archer is rigid and has no `Hips`, so live clips would make every archer spawn throw. **M4a's promote commit must set the live row's `clips` and `anticipation` to `PENDING_ARCHER_CLIPS` and remove the export. The plan does not say so yet.**
- **Chicken**: its row stays code-posed (`bones: []`).

## Checks in a throw-away worktree

The worktree is of HEAD, with the packed build over `public/models/monsters.glb`, the pending manifest over the live one, and the staged clips on the live archer row. That is what M4a ships. The scripts are `scratch/m3a/wt.sh` and `scratch/m3a/cap/`, not committed.

- `ONE(tests/monster-motion.test.ts)`: **56 passed, 32 skipped.** These ran and passed:
  - `goblin_archer` in "a clip row names every bone its clips rotate" and in "every bone a row names exists on that model's skeleton and has weight";
  - `chicken` in the second, and its five code-pose cases.
- Full `SUITE` there: 8 failures in 4 files. All of them are M4a's promote follow-through or known red:
  - `model-cache-key` (the monsters key becomes `1bdba310`);
  - `model-vertex-colour` (chicken and archer are now painted, so the case's list of painted figures gains them);
  - `monster-merge`: five cases, the families fixture's `chicken`, `goblin` and `goblin_archer` entries. Measured: chicken cloth 216, skin 1,164, plain 1,056; goblin wood 96, iron 284, skin 3,980; archer wood 316, skin 4,044. The pivot families are now one entry per root;
  - `monster-models` "the two variant rows name their kits" (K3, known red).

  `model-contract.test.ts` passes, `totals.json` included.

## Sheets and capture

**Sheets** come from `SHEETS(scratch/models-build/m3a/monsters.glb, …) --only goblin,goblin_archer,chicken --worst --against public/models/monsters.glb`. On each against sheet the left figure is the shipped one.

- `m3a-archer-turnaround`, `-silhouette`, `-worst-pose`, `-against`, `-play-distance`.
- `m3a-raider-against` and `-turnaround`.
- `m3a-chicken-turnaround`, `-against`, `-worst-pose`. The chicken's worst-pose sheet moves biped bones it never uses in the game; only the head turn and the leg swing apply.
- `m3a-roster-silhouette.jpg` holds the whole file, unfiltered, at the 26-distance size. **Raider and archer are told apart**: the raider has the spear above its head and the round shield; the archer has the hood's outline, the bow line at its side and no shield.
- Worst pose: no gap and no vertex off the body is visible on the archer. The bow, quiver, hood, bracer and loincloth follow their bones.
- The renderer has no tile, so the skin looks greyer than in the game.

**Capture**: `m3a-ingame.jpg`, `m3a-ingame-archer-close.jpg` and `m3a-ingame-rows.json`.

- **Setup**: NVIDIA GPU (`scripts/capture-gpu.mjs`, ANGLE over D3D12, RTX 4070 Laptop), `vite build` and `vite preview` (port 4196) of the throw-away worktree, plus the D5 patch that exposes `__DEBUG.G`. Balanced tier, noon, clear, 960x600 crops, the hero standing beside the figure. No page or console error.
- **The grid**, row by row:
  - archer three-quarter, archer side, archer mid-`Ranged` from behind (time 0.450, full draw);
  - archer at distance 26, raider at 5.4, chicken side;
  - chicken front, chicken at 8.5, archer from behind (the quiver).
- **Every archer in view**: two skinned meshes with vertex colours and `FACET_CUT`, one `Skeleton`, an animator with the hero library's eleven clips, playing `Idle` and `Walk` as it wanders. `attackAnim` set by the job plays `Ranged` (time 0.450, then 0.833).
- **Every chicken**: three skinned meshes with vertex colours and `FACET_CUT`, one skeleton, no animator. `rig.lWing` and `rig.rWing` are the bones `LWing` and `RWing`, and the flap turns them (z between −0.12 and 0.56 across frames). `rig.leftLegPivot` is the leg bone (x up to −0.29 while it walks).
- **Draw calls** (HUD): Three Kettle Camp at 8.5 is 619 to 629, with colour 204 to 214 and shadow 415. D5's camp row was 741 (colour 236, shadow 506), but D5 framed another spot, so the two are not a like-for-like measure. The hen yard at 8.5 is 552 to 553.

## Open for the main session and the owner

1. **The chicken's wings are on `LWing` and `RWing`, not on the arm bones** as plan M3a and design 4.6 say. The engine flaps the wings only through objects named `LWing`/`RWing` (`loop.ts`, `findPivot` in `blenderMonsters.ts`), and neither file is M3a's. On the arm bones the flap would stop, and the row's `codeAttack` (`rightArmX` −1.45) would swing a wing 83 degrees. Two changes follow from the bones:
   - the wings now hinge at their roots, where today's meshes turned about the figure's origin at the feet;
   - the chicken now has a `HeadGroup`, so the code pose's idle look-around and flinch nod move its head, which they could not do before.
2. **M4a** must also do the promote follow-through listed above: cache key, vertex-colour case, the three `monster-families.json` entries and `totals.json` by its rule.
3. **"Material name substrings"**:
   - The chicken keeps today's family words (`skin`, `cloth`, `gold`). Its eyes were the unlit `horn` meshes and are now dark paint on the lit beak mesh.
   - The archer's families went from eleven materials to `skin` and `wood`, as the raider's did at S2.
4. **`main()` is unchanged.** Its merge `keep` pattern still names `chicken_[LR]Wing`, which no mesh now has. It is harmless, and `main()` is outside M3a's two builders.
5. The archer's hood is a faceted shell with an open front. At 5.4 in the game it reads as a dark cowl framing the face. Whether it reads as a hood or as a cap is the owner's call at OM-S5.
