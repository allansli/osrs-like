# Models pass: final check (task X3)

Date: 2026-11-26. Branch `feat/models-pass`, run at `d85b10a` (X0 and X2 merged; monsters `?v=11081170`, hero `c56c4135`, gear `8a3c0d1b`). This is the agent part of plan task X3. Nothing was promoted: `public/models/`, `blender/` and every GLB are as X2 left them, and no file under `src/` or `tests/` changed. The [HUMAN] items and OM-F are at the end, **open**.

## Verdict

| X3 Accept item | Result |
|---|---|
| SG | **met**: SUITE, TYPES and BUILD exit 0 (below) |
| P5 repeated: a full rebuild compares clean against what is shipped | **met for hero, gear and monsters**: each packed rebuild is byte-identical to the shipped file. **Not met for `world.glb`**: Contract passes, Budget fails by 3,632 Brotli bytes (finding F1) |
| Wire total within the X2 ceiling, measured on the preview | **open** ([HUMAN], the `curl` below). Local Brotli quality 3 of the shipped files: 2,043,428 bytes against the 2,600,000 ceiling. This is a local number, not the preview measurement |
| Stage 5's budgets still hold | **draw calls, triangles and the leak check: met** at the start pose. **JS chunk: missed by 12.91 kB** (finding F2). Frame time: owner only |
| OM-F | **open** |

## SG

| Gate | Command | Result |
|---|---|---|
| SUITE | `flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run` | exit 0: 126 files, 1,417 passed, 3 skipped (in `tests/monster-motion.test.ts`), 42 s |
| TYPES | `flock /tmp/claude-capped.lock scripts/capped.sh npx tsc --noEmit` | exit 0, no output |
| BUILD | `flock /tmp/claude-capped.lock scripts/capped.sh npm run build` | exit 0; `index-BAx49TjD.js` 1,096.64 kB (gzip 310.93), CSS 37.73 kB, four fonts 69.78 kB |

## P5 repeated

Blender 5.0.1 (`/usr/bin/blender`), one process at a time behind `/tmp/claude-blender.lock`. The build went into a fresh `scratch/models-build/x3`. `tests/fixtures/model-contract/pending/` was empty, so every compare read the live manifest. `hero.glb` and `monsters.glb` were packed with `packGlb` (`scripts/lib/glb-pack.mjs`, the promote step's 8-bit pass) before the compare, because the shipped files are packed. `models-promote.mjs` was not run.

| Step | Command | Result |
|---|---|---|
| hashes before | `sha256sum public/models/*.glb blender/*.blend` | 8 files, listed below |
| BLEND(all) | `flock /tmp/claude-blender.lock timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs all --out scratch/models-build/x3` | exit 0, 21 s |
| pack | `packGlb` on the built hero and monsters | hero 331,656 to 246,604 bytes; monsters 3,690,812 to 2,248,648 |
| COMPARE(hero) | `node scripts/models-compare.mjs scratch/models-build/x3/hero.glb public/models/hero.glb` | exit 0; Contract and Budget pass; "Zero drift detected against shipped file" |
| COMPARE(gear) | same pattern | exit 0; zero drift |
| COMPARE(monsters) | same pattern | exit 0; zero drift |
| COMPARE(world) | same pattern | **exit 2**; Contract passes; `FAIL: Budget ceiling exceeded for 'brotliBytes': actual 493474 > ceiling 489842`; Drift: generator `v5.2.41` to `v5.0.21`, rawBytes 2,776,656 to 2,776,568 |
| identity | `cmp` built against shipped | hero, gear, monsters **byte-identical**; world differs |
| determinism | second BLEND(hero) into `scratch/models-build/x3b`, packed, `cmp` with the first | byte-identical |
| hashes after | same `sha256sum`, `diff` with the first list | equal |
| UNTOUCHED | `git status --short public/models blender` | prints nothing |

```
8a3c0d1b42f0fe014c4d2a79bb9776c0890d3f6ede796fafa7d6ef84c0da8f8a  public/models/gear.glb
c56c41358592f25e029679181fb0b475fe24667a525c3b11223a4d40e8503588  public/models/hero.glb
1108117041dc8ca6105d059ec64e518fe1e216e5ddffec8bb27f8986871f5b60  public/models/monsters.glb
0337e5bf869a4a8c50c46381a53aa5f835b62fdadfd4a9543107587ce2251500  public/models/world.glb
d3541a9b751d68f516a22524fb9f45c3e23391a90a6d244d98c8f98dcea56ae7  blender/gear.blend
1621b74ce4be3a57013b34eaf36d31ff6d8b4bed78c872abedb04f9234da891a  blender/hero.blend
cc9eb6e4e3699d36d295dea38fd365917b1164d8f151bb62cb3eec5d5dfcb7b0  blender/monsters.blend
0a2cba253036642b1b5043dbc138b60efe364984b8470b7c2963404d11eb31b2  blender/world.blend
```

**F1, the world file's Budget.** `world.glb` is the only file this stage never rebuilt. It still ships the Blender 5.2.4 export of 14 November (`world.glb` and `world.blend` hashes equal P5's list). A 5.0.1 rebuild orders buffers differently and compresses to 493,474 Brotli bytes, 0.74% over the shipped 489,842. Until X2 the world ceiling was 494,741, which that rebuild met, and P5 passed on it. X2 (`8e1fd49`) set the ceiling to design 9.2's "untouched" 489,842, with no headroom. The shipped file passes `tests/model-contract.test.ts`; only a rebuild fails. X3 must not change a test or a ceiling, and the rule is "a ceiling is raised only by an owner decision". **For the main session and the owner:** either the world ceiling gets the same 2% rebuild headroom the per-figure ceilings carry (plan 0.2's BLEND row), recorded in the design's review log, or the world file is left out of rebuild compares.

## Bytes

Local Brotli quality 3 (`zlib.brotliCompressSync`, quality 3) of the shipped files. These are **not** the preview's `curl` sizes, which are open below.

| File | Before the stage (design 9.2) | Shipped now, raw | Shipped now, Brotli q3 | X2 ceiling |
|---|---|---|---|---|
| `hero.glb` | 137,913 | 246,604 | 120,678 | 150,000 |
| `gear.glb` | 668,121 | 1,870,908 | 512,031 | 690,000 |
| `monsters.glb` | 1,266,221 | 2,248,648 | 920,877 | 1,270,000 |
| `guard.glb` | 1,174,350 | deleted | 0 | 0 |
| `world.glb` | 489,842 | 2,776,656 | 489,842 | 489,842 |
| **Total** | **3,736,447** | **7,142,816** | **2,043,428** | **2,600,000** (`totals.json`) |

The stage takes 1,693,019 bytes (45%) off the models on the wire, against the design's goal of at most 2,600,000 with N-3. Raw parse bytes fall from 11.9 MB to 7.14 MB (design 9.3 estimated 7.2 MB with N-3).

## Stage 5's start pose and the camp, re-captured

Throw-away worktree of `d85b10a` with one uncommitted patch that adds `G`, `performPlayerAttack` and `spawnLevelUpFireworks` to `window.__DEBUG`. Built with the capped `vite build`, served with `vite preview` on port 4197, and driven by headless Chromium on the NVIDIA GPU (`scripts/capture-gpu.mjs`: ANGLE over D3D12, NVIDIA GeForce RTX 4070 Laptop GPU). Settings: 1280x720, balanced tier, noon, clear weather, seeded `Math.random`, skills at 99, the hero kept alive. "Colour" is draw calls per frame to the canvas and "shadow" is draw calls to a render target, both averaged over 1 s. "HUD" is `#perf-calls`. After the run the preview was stopped and the worktree removed. No page error and no console error. This is the M0p, D5 and M4c procedure. Three samples per pose:

| pose | colour | shadow | HUD |
|---|---|---|---|
| P1 noon (start pose) | 299, 296, 294 | 342, 344, 341 | 641 calls 509k tris; 640, 509k; 635, 503k |
| goblin camp (`three_kettle_camp`, yaw 0, pitch 0.3, distance 8.5) | 179, 177, 177 | 339, 338, 338 | 514 calls 445k tris; 515, 442k; 515, 442k |

Every one of the 42 monsters in the world is on the skinned path: 23 with 4 skinned meshes, 17 with 3 and 2 with 2. None is rigid.

**GR7 limits** (the owner moved them to this stage on 2026-11-24; P1 noon balanced, against Stage 5's V2 capture: colour 1178, HUD 2170, 675k triangles):

| limit | M0p (`s0b/perf.md`) | D5 (`s4/d5-promote-perf.md`) | X3 | result at X3 |
|---|---|---|---|---|
| colour calls at most 1000 | 691 | 541 | 299 | pass |
| colour calls at most 60% of V2 (706) | 691 (58.7%) | 541 | 299 (25.4%) | pass |
| calls with the shadow pass at most 60% of V2 (1302) | 1307, **missed by 5** | 980 | 641 (29.5%) | pass |
| triangles at most 550k | 677k, **missed** | 543k | 509k | pass |

The two misses M0p carried to Slice 8 are closed. They were closed at D5, and they stay closed at X3. M4c's capture read the same numbers before X0 (`s7/m4c-promoted-perf.json`: 297 / 342 / 638 calls, 505k).

**GM7, goblin camp draw calls (M0p, S3, X3):**

| | colour | shadow | HUD |
|---|---|---|---|
| merge-only before M0p | 637 | 1152 | 1794 calls, 605k |
| M0p | 357 | 684 | 1041 calls, 604k |
| S3 (`s1/README.md`, pilot goblins, the rest rigid) | | | 741 with the five goblins in view (controlled) |
| D5 | 236 | 506 | 741 calls, 486k |
| X3 | 177 | 338 | 515 calls, 442k |

## Leak check

The check follows `docs/superpowers/baseline/g2/leak-check.md` and Stage 5's G-6 wording (200 attacks, 5 level-ups, 20 gear swaps):

1. Same throw-away build as above. The hero stands 1.1 units from the nearest goblin at the camp, and the goblin's HP is set to 100,000 before every attack, so it never dies.
2. **Warm-up**: 20 attacks, 2 fireworks and 4 gear swaps, then 45 s idle and the reading "before".
3. **Run**: 200 attacks, 5 fireworks and 20 gear swaps, then a reading right away ("mid"), 45 s idle, and the reading "after".
4. Each attack calls the game's own `performPlayerAttack` six frames apart.
5. Each gear swap writes one of two loadouts into `STATE.equipment` and calls `rebuildPlayerEquipmentMeshes`. The loadouts are bronze scimitar, bronze plate and bronze legs, and steel longsword, adamant plate and adamant legs.

| reading | geometries | textures | programs |
|---|---|---|---|
| before | 2190 | 80 | 28 |
| mid (right after the run) | 2189 | 80 | 28 |
| after (45 s idle) | 2189 | 80 | 28 |

**Met:** geometries and textures are back to their start values (geometries one below the start).

The run is not vacuous:
- all 200 attacks set the attack animation;
- 193 of them took HP off the goblin (the other 7 missed);
- no attack was refused;
- the 20 swaps alternated two different mounted mesh sets (`Gear_scimitar_*` against `Gear_sword_*` on the plate body and legs, 22 meshes each).

## Stage 5's budget table (visual-pass design 10), row by row

| Measure | Limit | X3 | Result |
|---|---|---|---|
| Draw calls, start pose, colour pass | at most 60% of V2 and at most 1000 | 299 | pass |
| Draw calls, start pose, with shadow pass | at most 60% of V2 (1302) | 641 | pass |
| Triangles, start pose | at most 550k | 509k | pass |
| Frame time on the owner's GPU (`look.bench`) | balanced within 10% of the V2 bench | headless `look.bench` read 27 to 68 ms, which is not valid (Stage 5 baseline) | **owner only**; the V2 bench table is still empty |
| JS chunk | at most V2 (992.73 kB) plus 91 kB = 1,083.73 kB | 1,096.64 kB | **missed by 12.91 kB (F2)** |
| CSS | at most 45 kB | 37.73 kB | pass |
| Fonts | at most 120 kB | 69.78 kB | pass |
| Models on the wire | 3.76 MB | 2.04 MB local Brotli q3 | pass (preview `curl` open) |
| GPU geometries after 200 attacks and 20 gear swaps | back to the start value | 2190 to 2189 | pass |

**F2, the JS chunk.** The R0 base `0a1d0dc` (main with Stages 4 and 5 merged, built in a throw-away worktree with the same capped `vite build`) ships 1,083.55 kB, 0.18 kB under Stage 5's limit. This branch ships 1,096.64 kB, so the models pass adds 13.09 kB of script. That covers the skinned path, the monster animator and the motion table, the kit and body fields, and `mountLoadout`. The models-pass design sets no JS budget, and no plan task measured the chunk. **For the owner:** accept the +13.09 kB and raise Stage 5's JS limit, as for Stage 4 (+36 kB, 2026-11-15), or name code to cut.

## Sheets and captures, before and after

The before sheets are V3's (`before/`) and V4's (`before-ingame/`, seven in-engine poses). The after sheets are each slice's last task. Every directory is in `docs/superpowers/baseline/models/`.

| Figure | Before | After (sheets) | After (in the game) |
|---|---|---|---|
| hero | `before/hero/` (turnaround, play distance, `Idle` `Walk` `Slash` `Lunge` `Fish` strips), `before-ingame/model-hero-close-balanced.jpg`, `model-hero-play-balanced.jpg`, `s2/before-hero-*.jpg` | `s2/h7-hero-{against,turnaround,play-distance,silhouette,worst-pose}.jpg`, `s2/h4-hero-<clip>-{strip,side}.jpg` for the eleven clips | `s2/h7-game-*.jpg` (idle close and play, walk, slash bare, plate idle and slash, death at 900 and 1700 ms, merchant), `s2/h5b-hero-*-close.jpg` |
| gear (merge only) | `before/gear/` (six shared silhouettes, five named pieces, roster) | `s3/gear-against/<root>-against.jpg` (the eleven roots, left before, right merged) | `s3/g6-{plate,bandos}-{idle,slash}.jpg` |
| guards | `before/guard/`, `before-ingame/model-guards-balanced.jpg`, `s3/n3-gate-*-before.jpg` | (built from the hero and gear; no sheet of their own) | `s3/n3-gate-*-after.jpg`, `s3/n3b-gate-{play,front}.jpg` |
| goblin raider | `before/monsters/goblin-*.jpg`, `before-ingame/model-camp-goblin-balanced.jpg`, `s0b/before-*.jpg` | `s1/a3-goblin-*.jpg`; `s5/m3a-raider-{against,turnaround}.jpg` | `s0b/after-*.jpg`, `s1/ingame/` (`base-*` today against `s2d-*` the pilot), `s4/m1b-goblin-*.jpg` (on the hero's clips) |
| dragon | `before/monsters/elvarg_dragon-*.jpg`, `before-ingame/model-camp-dragon-balanced.jpg` | `s4/d2-dragon-*.jpg`, `s4/d2b-dragon-<clip>-strip.jpg`, `s4/d2b-dragon-clips-{side,threeq}.jpg` | `s4/d2b-dragon-{walk,bite,windup,wingbuffet,death}.jpg`, `s4/d5-lairs.jpg` |
| Ashmantle | (no own model before; the dragon's) | `s4/d3-ashmantle-*.jpg`, `s4/d3-dragon-ashmantle-silhouette-85px.jpg` | `s4/d2b-ashmantle-windup.jpg`, `s4/d5-lairs.jpg` |
| lesser demon | `before/monsters/lesser_demon-*.jpg`, `before-ingame/model-camp-pass-balanced.jpg` | `s4/m3d-demon-*.jpg` | `s4/m3d-demon-ingame.jpg`, `s4/d5-lairs.jpg` |
| goblin archer, chicken | `before/monsters/{goblin_archer,chicken}-*.jpg` | `s5/m3a-archer-*.jpg`, `s5/m3a-chicken-*.jpg` | `s5/m3a-ingame*.jpg`, `s5/m4a-promoted-{ingame,camp-yard}.jpg` |
| scorpion | `before/monsters/scorpion-*.jpg`, `before-ingame/model-camp-dunes-balanced.jpg` | `s6/m3b-scorpion-*.jpg` (with `Idle` `Walk` `Strike` `Death` strips) | `s6/m3b-ingame.jpg`, `s6/k4-promoted-ingame.jpg` |
| dark wizard, dark ranger | `before/monsters/{dark_wizard,dark_ranger}-*.jpg` | `s6/m3e-{wizard,ranger}-*.jpg` | `s6/m3e-ingame.jpg`, `s6/k4-promoted-ingame.jpg` |
| Saltback Stalker, Thornwatch Marksman (kits) | (tints only before) | `s6/k1-stalker-*.jpg`, `s6/k2-marksman-*.jpg` | `s6/k4-promoted-ingame.jpg` |
| hill giant, moss guardian | `before/monsters/{hill_giant,moss_guardian}-*.jpg` | `s7/m3c-{giant,guardian}-*.jpg` | `s7/m3c-ingame.jpg`, `s7/m4c-promoted-ingame.jpg` |
| roster silhouettes (GM6) | `before/monsters/roster-silhouette.jpg` | `s5/m4a-roster-silhouette.jpg`, `s6/k4-roster-silhouette.jpg`, `s7/m4c-roster-silhouette.jpg` (every figure) | |
| performance | `s0b/perf.md` | | `s4/d5-promote-perf.md`, `s6/k4-promoted-perf.json`, `s7/m4c-promoted-perf.json`, this file |

Compare reports of each promotion: `s5/m4a-promote-compare.md`, `s6/k4-promote-compare.md`, `s7/m4c-promote-compare.md`. The pilot's and the hero's pattern: `README.md` (S2 to S2d, H3c) and `s2/README.md`. X3's own screenshots and raw rows (`P1-noon.jpg`, `camp-goblin.jpg`, `leak-end.jpg`, `perf.json`, `leak.json`) are in `scratch/x3/cap/out/`, outside the tree: X3's file list is this file and `README.md`.

## Hand-off (design section 10)

### To Stage 6

Stage 6 receives:

1. **The safe pipeline and review loop:**
   - `scripts/run-blender.mjs` (`--out`, never the shipped folders), `scripts/models-compare.mjs` (Contract, Budget, Drift) and `scripts/models-promote.mjs` (packs hero and monsters with `scripts/lib/glb-pack.mjs`, N-3);
   - `scripts/blender/review_render.py` (sheets) and `scripts/capture-gpu.mjs` (in-engine captures);
   - the README in this directory (how a sheet is made and what it proves).
2. **The figure kit** `scripts/blender/figkit.py`, used by every builder: `make_rig`, `organic_body`, `auto_weights`, `hard_weights`, `fold_weights`, `merge_by_family`, `make_clip`, paint and export.
3. **Three skeletons and their clip libraries:**

   | Skeleton | Bones | Clips, in the file | Authored on |
   |---|---|---|---|
   | biped | 16 | 11, in `hero.glb` | the hero |
   | crawler | 20 | `Idle`, `Walk`, `Strike`, `Death` | the scorpion |
   | dragon | 22 | `Idle`, `Walk`, `Bite`, `WingBuffet`, `Death` | the dragon, shared by Ashmantle through `body: 'ashmantle'` |
4. **The skinned path in the engine:**
   - the only monster path after X0: `upgradeMonsterRigWithGltf` refuses a rigid `Monster_` node;
   - the hero's loader keeps rigid hair and eyes on the head bone;
   - culling spheres are set on the template, and outline shells are skinned;
   - painted skinned figures take the `cut` shade.
5. **The motion table** `src/data/monsterPoses.ts`:
   - each row names library clips and an `anticipation` (Stage 4's wind-up), plus an optional `windup` clip;
   - the chicken stays `code_posed`.
6. **The look fields** `kit` and `body` on `MonsterDef`. A variant gets `Kit_<name>` rigid pieces on its base's bones, and the kit ceiling is 4 rigid meshes (owner, 2026-11-26).
7. **The budget classes of design 9.1**, set in the manifests by X2. For Stage 6's three slots, use the N-3 column:
   - swarm creature: 1,200 triangles, 1 mesh, 21 kB;
   - camp captain: large class, 7,000 triangles, 4 meshes, 110 kB;
   - dungeon boss: boss class, 14,000 triangles, 4 meshes, 220 kB.

   The wire total has 556,572 bytes of room under 2,600,000 (local q3). Design 9.2 reserves about 0.35 MB for Stage 6 with N-3.
8. **The contract for a new monster:**
   - one `Monster_<model key>` node at the file's origin, with a skin on one of the three skeletons;
   - bones named `<model key>_<Bone>`;
   - a motion-table row naming library clips;
   - a manifest entry (and a pending one until its promotion);
   - a `monster-families.json` entry by the rule of `tests/monster-merge.test.ts`;
   - its `vertexColor.figures` place;
   - a credit row if third-party.

   A new biped or crawler monster is one builder function, one data row and one review, with no new animation.
9. **The art direction of design section 5 and the pilot's pattern** (`README.md`, "The pattern, in order"): route (a) carved body, three material families, plane tones, the 18% value floor, and each paint divided by the mean of the tile that draws it.

### To the follow-up stage "Models pass, part 2: gear" (decision N-2)

1. **Gear bands** (design 5.5), gear brought to its budget, gear paint. `gear.glb` is merged only: 512,031 Brotli bytes against 690,000; design 9.2 reserves about 0.23 MB.
2. **Skinned gear:** robe skirts, capes, trousers across the knee. This needs a second mounting path beside `mountLoadout`, with weights per piece (design 6.1.4).
3. **Per-species idle traits and second attack clips** (or Stage 6, per boss).
4. **Gear band nodes** (`_b2`, `_b3`) in the gear manifest (design 8.2).

### Engine items carried from the slices, still open

None of these could be fixed in X3, which must not change `src/`.

1. **Outline gaps on upward-facing edges.** The shell's view-space z push (`uThickness*2.5+0.045` in `outlineMaterial`) leaves 25 to 32% of a skinned figure's silhouette without a line. Today's rigid goblin is at 22%, and rigid shells have the same push. Found at S3c and carried to Slice 8. **No Slice 8 task took it**, so it is open.
2. **Culling sphere at the strike.** A swinging part can leave its mesh's bounding sphere and be culled at the screen edge mid-swing:

   | Mesh | Pose | Outside its sphere by | Found at |
   |---|---|---|---|
   | `dark_wizard_glow` | mid-`Cast` | 0.345 | M3e (`s6/README.md`) |
   | `dark_wizard_staff` | mid-`Cast` | 0.059 | M3e |
   | `dark_ranger_wood` | mid-`Ranged` | 0.105 | M3e |
   | `hill_giant_club` | mid-`Slash` | 1.48, against a radius of 0.725 | M3c (`s7/README.md`) |

   The fix is padding or a per-clip sphere in `blenderMonsters.ts`. Other figures were not measured.
3. **F1** (world ceiling against a rebuild) and **F2** (JS chunk), above.

## Open owner checks

None of these is done.

1. **[HUMAN] Wire sizes from the preview deployment.** Against the deployment's URL, per file:

   ```
   for f in hero gear monsters world; do curl -s -H 'Accept-Encoding: br' -o /dev/null -w "$f %{size_download}\n" "<preview URL>/models/$f.glb"; done
   ```

   Sum the four against `totals.json`'s 2,600,000. The local q3 sum is 2,043,428. A host may compress at a different quality, or not at all. If `content-encoding` is not `br`, the number is not the wire size.
2. **[HUMAN] Ten minutes on a real GPU.**
   - Walk the camps: the start town and the guards, Three Kettle camp, the dunes, Cinderstep Pass, the dragon's lair, Ashmantle's arena, the woods (moss guardians and marksmen), and the hill giants.
   - Fight a goblin, a scorpion and a demon.
   - Swap gear.
   - Watch the screen edge during strikes (engine item 2) and the outline on bent limbs (engine item 1).
   - While there, fill Stage 5's frame-time table (`look.bench(300)` at P1, P3, P5, P8 on each tier).
3. **OM-S0b, OM-S4, OM-S5, OM-S6, OM-S7.** The owner's reading of each slice's sheets and of the game after the merge (the run's brief: the owner checks OM-S4 to OM-S7 after the merge). The calls each slice left for the owner are in that slice's README:
   - S5: the archer's hood, and the chicken's wings;
   - S6: the stalker's three-point sting, the marksman's two quivers, and the kit-salt value gap;
   - S7: the giant's `Slash` and the guardian's `Chop`, and the one glow;
   - S4: Ashmantle's hide at the 18% floor.
4. **F1 and F2**: an owner decision for each.
5. **OM-F**: accept the stage. This blocks the pull request.
