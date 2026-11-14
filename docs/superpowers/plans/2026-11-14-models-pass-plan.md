# Models pass: implementation plan

Date: 2026-11-14. Branch: `feat/models-pass`. Design: `docs/superpowers/specs/2026-11-14-models-pass-design.md` (called "the design" below; section numbers refer to it). Source line numbers are at commit `5caa597`.

The design is a proposal. Nothing in this plan starts before owner step **OM-0** (section 0.5), and nothing starts before Stages 4 and 5 are merged to `main` (task R0).

---

## 0. Conventions

### 0.1 Task tags and tiers

As in the foundation plan (`docs/superpowers/plans/2026-11-13-world-foundation-plan.md` 0.1):

- **[AGY]**: fully specified, handed to agy through `/agy-implement` (one worktree) or `/agy-parallel`. Three stages, never merged: **haiku** runs the `agy -p` command and returns the diff stat, test output and exit status; **sonnet** implements only if agy failed or refused, and records that it did; **opus** verifies the diff against the allowlist, runs the acceptance check, and looks for weakened or deleted assertions and edits to [CLAUDE] tests. "Tier" on an [AGY] task is the tier that works if agy fails.
- **[CLAUDE]**: tests that define acceptance, licensing text, every verification, and work the plan cannot fully specify. **All art tasks are [CLAUDE]**: what a goblin should look like cannot be written as a diff in advance.
- **[RUN]**: run a given command and return its raw output. Haiku. It judges nothing. The task that follows judges.
- **[OWNER]** and **[HUMAN]**: a decision, or a look at the running game on a real GPU.
- **[CLAUDE, main session]**: a promote task. Subagents never promote a model, merge, tag, push or open pull requests; the main session runs the promotion (0.3 rule 2) with a sonnet step for the commands and an opus read of the compare report and the sheets. No commit carries an AI attribution trailer.

Model tiers used: haiku for [RUN]; sonnet for pipeline scripts, wiring and tests from a clear spec; opus for art builders, every verify and every judgement of a sheet. **One fable stage: M2**, the pattern figure that eight more follow (owner model rules: "the design that every later stage builds on"); its verify stays opus. Escalate H3a to fable only if its first opus attempt is rejected at the owner step.

### 0.2 Commands

Run from the worktree root, in a shell started with an allowlisted environment: `env -i HOME="$HOME" PATH="$PATH" XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" bash`.

`CAP` stands for `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0`.

| Name | Command | Expected |
|---|---|---|
| SUITE | `CAP env TEST_CONCURRENCY=4 npx vitest run` | exit 0 |
| ONE(file) | `CAP env TEST_CONCURRENCY=4 npx vitest run <file>` | as the task says |
| TYPES | `CAP env TEST_CONCURRENCY=4 npx tsc --noEmit` | exit 0, no output |
| BUILD | `CAP env TEST_CONCURRENCY=4 npm run build` | exit 0 |
| BLEND(mode) | `CAP timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs <mode> --out scratch/models-build` | exit 0; files only under `scratch/models-build/` |
| COMPARE(name) | `node scripts/models-compare.mjs scratch/models-build/<name>.glb public/models/<name>.glb` | exit 0 = Contract (built file against `tests/fixtures/model-contract/<name>.json`) and Budget pass; Drift (built against shipped) is reported, never fails; the report is printed and written to `scratch/models-build/<name>.report.md` |
| CAPTURE(name) | In a throw-away worktree of the task's head: copy `scratch/models-build/<name>.glb` over `public/models/<name>.glb`, take the slice's in-engine poses as V4 does, delete the worktree | JPEGs under the task's sheet directory; nothing promoted |
| SHEETS(glb, dir) | `CAP timeout 600 /usr/bin/blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/blender/review_render.py -- <glb> <dir>` | exit 0; JPEG sheets in `<dir>` |
| UNTOUCHED | `git status --short public/models blender` | prints nothing |

**Standard gate (SG)**: SUITE, TYPES and BUILD pass. Every task ends with SG unless it says otherwise. **Blender gate (BG)**: the task's BLEND and COMPARE pass and UNTOUCHED prints nothing. A wrapper kill for memory or time is a defect to fix. Never raise the cap or the timeout.

Machine rules: one Blender process at a time, machine-wide. One BUILD at a time. At most 3 agents at once.

### 0.3 Rules that apply to every task

1. **Allowlist.** A task touches only the files listed for it.
2. **Builds never write shipped files.** Only `scripts/models-promote.mjs`, run by the main session in a task whose title starts with "Promote", changes anything under `public/models/` or `blender/*.blend`. Every other task ends with UNTOUCHED. A promote task changes exactly the files it names.
3. **Existing tests are frozen.** No edit to any file that exists under `tests/` or `src/__tests__/` when the stage starts. The one declared replacement is in task H5 (design 8.3). New tests go in new files under `tests/`.
4. **Test-first pairs.** A [CLAUDE] test task may leave SUITE, TYPES and BUILD red only in its own new files and only because the paired task's export or file does not exist yet.
5. **Contracts change only with the manifest.** A task that adds a node, pivot, clip or `extras` key edits its file's manifest, `tests/fixtures/model-contract/<file>.json`, in the same commit and says so. No task removes or renames a manifest entry, except slice 3 removing the guard file.
6. **Evidence, not opinion.** An agent reports numbers and paths. "Looks better" is said only by the owner. Every art task ends with before and after sheets committed.
7. **No new runtime dependency. No new dev dependency** either: the tools are node built-ins and Blender's own Python (numpy included).
8. **Line numbers go stale.** Find symbols by name.
9. **No rule, name or save change** (design 12). The opus verify rejects any diff under `src/state/`, and any diff under `src/data/` other than the two look tables (G1, M1b), the optional `kit` field on `MonsterDef` (D1b) and its value on Stage 4's three rows (K3). No `model` value changes (critique C4).
10. **Commit format**: `<kind>(models-<slice>): <what>`, kinds `feat`, `fix`, `test`, `tool`, `asset`, `docs`. Promotions are `asset(models-<slice>): promote <file> <8-hex hash>`. Review sheets are `docs(models-<slice>): before/after sheets`.

### 0.4 Branches and clusters

- Slice 0 runs serially on `feat/models-pass`, including H6 and H6b (the engine's vertex-colour flag touches `blenderHero.ts`, `blenderMonsters.ts` and `blenderGear.ts`, so it lands before the clusters fork).
- After slice 0, three clusters touch different build scripts, engine files and manifest files, and may run in separate worktrees `../osrs-like-wt/mp-<cluster>` on local branches `mp/<cluster>`, never pushed: **hero** (slice 1: `build_hero.py`, `blenderHero.ts`, `actions.ts`, `model-contract/hero.json`), **gear** (slice 2: `build_gear.py`, `playerGear.ts`, `src/data/gearBands.ts`, `model-contract/gear.json`), **monsters** (slices 0b, 5, 4a to 4c, 6: `build_monsters.py`, `monsterMeshes.ts`, `blenderMonsters.ts`, `src/data/monsterPoses.ts`, `model-contract/monsters.json`). They merge one at a time, each promotion rebuilt on the merged head. Inside the monster cluster every task writes `monsters.glb` and runs **serially**.
- Slice 3 touches `src/` (`worldBuild.ts`, `playerMesh.ts`) and deletes the guard files; it waits for G2b. `blenderGear.ts` is touched only by H6b (slice 0) and G6 (the `?v=` key). Slice 7 comes last.

### 0.5 Owner and human steps

| Step | What the owner decides or does | Blocks |
|---|---|---|
| OM-0 | Approve the design's scope and answer the critique's D-1 (cut or skin the dragon, Ashmantle and demon), D-2 (dragon first), D-3 (knight `.blend`), D-5 (merge-only pass), D-6 (cut studies), then CALL-M2 (guards), M3 (rigid figures), M4 (keep the hero), M5 (future monsters as studies), M7 (dragon), M6 (two hero clips), M8, M9, M9b, M10, M11, M13. D-4 (motion style) is answered at OM-H4a. | Everything |
| OM-H4a | Look at the one-clip spike in the game, stepped and interpolated; answer D-4. | H4b |
| OM-1 | Look at the baseline sheets (task V3) and the in-engine "before" captures (V4). Confirm or change the art direction (CALL-M1, M12). | Slices 1 to 7 |
| OM-S1 to OM-S6 | After each slice: look at the after sheets and at the game on a real GPU. Accept, or name what is wrong. | The next promotion of the same file; the slice's merge |
| OM-F | Accept the stage after X3. | The pull request |

If CALL-M2 is answered "keep the knight", slice 3 becomes task N-alt. If CALL-M6 is "no", H5 and H5b are dropped and H4b adds no clip; "Death only" drops just the `Hurt` parts. If CALL-M11 is "no", H6, H6b and every "bake" step are dropped and the palette rules carry the look alone. If D-5 is "no", M0 and M0p are dropped. If D-6 is "cut", X1 is dropped. If D-2 is "no", slice 5 runs after M4c as first drawn. No other task changes. A "no" on CALL-M3 (rigid figures), M4 (keep the hero) or M7 (dress the existing dragon), or "skin" on D-1, is a different stage: the design and this plan are redrawn before anything starts.

### 0.6 Goals and proofs

| Goal | Proof |
|---|---|
| GM1 A build cannot change a shipped file | `tests/model-pipeline.test.ts` (P1); UNTOUCHED after P5's full rebuild |
| GM2 Every engine contract is written down and checked | `tests/model-contract.test.ts` green on every run (P4) |
| GM3 Every figure can be looked at, before and after | Sheets committed per slice (V3, each slice's last task) |
| GM4 The hero moves with weight and has no open joints | `tests/hero-model.test.ts` (H1); motion strips (H4a, H4b, H7); owner steps OM-H4a, OM-S1 |
| GM4b The dragon, Ashmantle and the demon move | `tests/monster-motion.test.ts` (D2a): every contract pivot of every monster holds at least one mesh; owner step OM-S5 |
| GM5 Gear bands read from the outline | Silhouette sheet of one body in three bands (G6); `tests/gear-bands.test.ts` |
| GM6 No two species share a silhouette | Roster silhouette sheet at 85 px (M5c, K4) |
| GM7 Monsters cost fewer draw calls (guards cost slightly more, design 9.1) | Manifest mesh budgets (design 9.1) in `model-contract.test.ts`; start-pose and goblin-camp draw calls captured before and after M0p |
| GM8 The download shrinks by about 0.9 MB | Brotli quality 3 total at most 2,850,000 in `model-contract.test.ts` (X2); `curl` of the preview deployment (X3) |
| GM9 Nothing about rules, names or saves changes | Rule 0.3.9 in every verify; SUITE untouched |
| GM10 Licences are complete | `tests/credits.test.ts` plus `tests/model-licences.test.ts` (P4) |

---

## R. Premise re-check

### R0 Re-check against merged Stages 4 and 5 [CLAUDE]
- **Tier**: opus.
- **Depends**: OM-0; Stages 4 and 5 merged to `main`; `feat/models-pass` rebased on it by the main session.
- **Files**: the two models-pass documents only.
- **Change**: confirm, citing file and line, or amend the design and this plan where reality differs: (1) `MonsterDef` has `model`, `tint`, `modelScale`, and the node lookup, pose and albedo read the model key; (2) `facetMaterial` still accepts extra parameters and what it does with `vertexColors`; (3) whether Stage 5's run-time merge touches figures or gear; (4) the debug pose hooks in `photo.ts` and how a capture is taken; (5) what Stage 4 did to `blender-hero.test.ts` line 136 and what `tests/new-monsters.test.ts` asserts about model keys (the critique's C4 expects "ten distinct model keys" and "the boss uses the dragon's model key"; the `kit` route must leave both green); (6) the five GLBs still hash as in design 3 (if not, re-measure section 4); (7) the dragon's and the demon's pivots are still empty (critique C1) and Stage 4 did not cut them; (8) every assertion in `tests/textures.test.ts` and `tests/dispose.test.ts` that touches a figure material or outline; (9) every file path in this plan still exists, and every name and offset contract of design 8.1 (`playerMesh.ts`) is where the design says.
- **Accept**: a "Review log" entry at the end of both documents listing each premise as confirmed or amended. No source change.
- **Must not change**: anything outside `docs/superpowers/`.

---

## Slice 0: safe pipeline and review loop

### P1 Pipeline tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: R0.
- **Files**: `tests/model-pipeline.test.ts` (new), `tests/fixtures/models/` (new, tiny hand-made GLBs written by the test's own helper, under 4 kB each).
- **Change**: with the stub-Blender method of `tests/run-blender.test.ts`:
  - `run-blender passes --out through after "--" on every build spawn` and `defaults --out to scratch/models-build`;
  - `every --background spawn carries --factory-startup` (the GUI `open` spawn is unchanged);
  - `all still spawns exactly four builds` and `guard is a mode`;
  - `export passes --out and the target name`;
  - compare (Contract is built against manifest, Drift is built against shipped): `a file equal to its manifest passes`; `a missing node fails Contract`; `a pivot 0.001 from its manifest position fails Contract`; `a pivot moved in both the file and its manifest passes Contract and shows as Drift`; `a renamed material fails Contract`; `a missing clip fails Contract`; `a merged mesh that swallowed a toggled name (TorsoCoat, Hair, _04_) fails Contract`; `COLOR_0 on some meshes of a file but not all fails Contract`; `one more triangle than the budget fails Budget`; `a different generator string is Drift only`; `a truncated file is refused before any check`;
  - promote: `refuses without --yes`; `refuses when compare fails`; `copies exactly the named file`; `refuses a name not in the manifest`.
- **Accept**: red until P2 and P3.
- **Must not change**: `tests/run-blender.test.ts`.

### P2 Output directory for every build [AGY]
- **Tier**: sonnet.
- **Depends**: P1.
- **Files**: `scripts/blender/paths.py` (new), `scripts/blender/build_hero.py`, `build_gear.py`, `build_monsters.py`, `build_world.py`, `export_guard.py`, `export_from_blend.py`, `check_local_gear_bounds.py`, `inspect_all_gear_glb.py`, `scripts/run-blender.mjs`, `package.json` (scripts only).
- **Change**:
  - `paths.py`: `repo_root()`; `out_dir()` reads `--out <dir>` after `--` in `sys.argv`, default `<repo>/scratch/models-build`, resolves it, and raises `SystemExit` with a message naming the path if it is inside `<repo>/public` or `<repo>/blender`; `checked_write(path)` applies the same refusal to any other write (the `--render <path>` preview option of `build_gear.py`, `build_monsters.py`, `build_world.py`); `glb_path(name)`, `blend_path(name)`; `source(rel)` for read-only inputs under `blender/examples/`; `extract_zip(zip, dest)` that refuses any member whose resolved path leaves `dest`.
  - Each script gets its write paths from `paths.py` and nothing else. `build_hero.py` extracts Kai under `out_dir()/kai`, and its preview render (step 10) is deleted. `export_from_blend.py` writes `<out>/<blend name>.glb` (today it always writes `public/models/hero.glb`). The two check scripts read the GLB given by `--glb`, default the built one. Scripts add their own directory to `sys.path` to import `paths`.
  - `run-blender.mjs`: parse `--out <dir>` anywhere after the mode; default `scratch/models-build`; add `--factory-startup` after `--background` on every background spawn (not `open`); append `-- --out <abs dir>` to every build and export spawn; add `guard: 'scripts/blender/export_guard.py'` as a mode that `all` does **not** include.
  - `package.json`: add `blender:guard`, `models:compare`, `models:promote`, `models:sheets`.
- **Accept**: `ONE(tests/model-pipeline.test.ts)` run-blender cases pass; `ONE(tests/run-blender.test.ts)` passes untouched; `grep -n "public.*models\|'blender'" scripts/blender/*.py` shows hits only in `paths.py`; `grep -n "render.filepath\|save_as_mainfile\|filepath=" scripts/blender/*.py` shows every write going through a `paths.py` function; SG.
- **Must not change**: what any script builds; `--disable-autoexec` and `--python-exit-code 1` on every spawn; `open` mode.

### P3 Compare and promote [AGY]
- **Tier**: sonnet.
- **Depends**: P1.
- **Files**: `scripts/models-compare.mjs` (new), `scripts/models-promote.mjs` (new), `scripts/lib/glb.mjs` (new: read JSON chunk and buffers, per-node triangles, bounds, Brotli quality 3 size).
- **Change**: as design 7.2. `glb.mjs` validates the magic, the declared lengths and every accessor's range against its buffer view before returning, and refuses a file over 8 MiB. Compare reads the manifest for contract and budgets, exits 0, 1 (Contract), 2 (Budget) or 3 (unreadable), and writes the report. Promote runs compare, requires `--yes`, copies to `<target>.tmp` then renames, prints the SHA-256, and prints the `?v=` key the loader must carry.
- **Accept**: `ONE(tests/model-pipeline.test.ts)` passes; SG.
- **Must not change**: nothing under `public/` or `blender/`.

### P4 Contract manifest, budgets, licences [CLAUDE]
- **Tier**: sonnet; opus verify reads the manifest against design 8.1 line by line.
- **Depends**: P3.
- **Files**: `tests/fixtures/model-contract/hero.json`, `gear.json`, `monsters.json`, `guard.json`, `world.json` and `totals.json` (new; one per GLB so parallel slices never edit the same file), `tests/model-contract.test.ts` (new), `tests/model-licences.test.ts` (new), `scripts/models-manifest.mjs` (new, writes a first manifest from the shipped files).
- **Change**: the manifest holds, per file: every contract node of design 8.1 with parent, translation and scale; pivot names per figure; material names; mesh name classes; **the toggled mesh names of design 8.1** (`Hair*`, `TorsoCoat`, `InnerCollar` and the coat prefixes; gear `_NN_` ordinals); **the centres of the hero's `Hand_L`, `Hand_R`, `Boot_L`, `Boot_R` and `Head` meshes in their pivot's space** (mount offsets of `playerMesh.ts`, tolerance 0.01); `extras` keys; whether `COLOR_0` is present (all or none); clip names and which pivots each must move; per-figure budgets (triangles, meshes, materials, Brotli quality 3 bytes of the figure's buffers: **today's measured values** as the first ceiling, lowered by each slice); raw and Brotli quality 3 ceilings per file, and the total in `totals.json` (today's values plus 1%). Tests: shipped files satisfy the manifest; no GLB JSON chunk contains `/home/`, `/Users/`, `C:\\` or `\\Users\\`; every entry under `blender/examples/` (directory or zip) is named in `CREDITS.md`, every directory holds a licence file, and every zip's bytes include a member name containing `LICENSE` (central-directory names are stored uncompressed; `Buffer.includes` is enough); each loader's `?v=` key (where one exists) is noted, to be tied to the hash from the first promotion on.
- **Accept**: both tests pass on today's files; SG.
- **Must not change**: `src/`, the GLBs.

### P5 Prove the pipeline: full rebuild into scratch [RUN], then [CLAUDE]
- **Tier**: haiku runs; opus judges.
- **Depends**: P2, P3, P4.
- **Files**: `docs/superpowers/baseline/models/p5-rebuild.md` (new).
- **Change**: [RUN] `sha256sum public/models/*.glb blender/*.blend`; BLEND(all); BLEND(guard); COMPARE for the five names; the same `sha256sum`; UNTOUCHED. [CLAUDE] writes the record: Blender version, generator strings, times, each report's summary, both hash lists.
- **Accept**: five builds exit 0; five compares exit 0 with zero Contract differences and zero Drift apart from the generator string and the three guard meshes design 3.2 found (floats within 0.00022); the two hash lists are equal; UNTOUCHED. A second BLEND(hero) gives a byte-identical binary chunk (the critique's E2 and E7 found builds and bakes deterministic).
- **Must not change**: everything shipped. **Nothing is promoted.**

### V1 Review renderer [AGY]
- **Tier**: sonnet.
- **Depends**: P2.
- **Files**: `scripts/blender/review_render.py` (new), `scripts/blender/review_scales.json` (new: figure name to in-game scale, from design 4.2).
- **Change**: arguments `<glb> <out dir> [--only a,b] [--against <other.glb>] [--clips] [--engine-palette]`. Cycles, CPU, 24 samples, one sun and one fill, grey world. Cameras face the figure's front (glTF +Z; the critique's strips came out from the back). For each root with meshes, the five sheets of design 7.3: turnaround (three views, 512 px), silhouette (same views, emission-black override on white), play distance (1080-line frame, 50 degree vertical field of view, distances 5.4, 8.5 and 26 with pitch 0.18, 0.24, 0.24, cropped to the figure, in-game scale applied, pixel height drawn in the corner), motion with `--clips` (per clip: **set every object's `animation_data.action` to `None`**, then mute every NLA track but that clip's, six evenly spaced frames; print each pivot's rotation range in the clip; without clearing the action the importer's `Idle` overrides every clip, critique C2), and side-by-side with `--against`. `--engine-palette` colours the hero by `extras.part` with the colours of `blenderHero.ts` 182-197. One roster silhouette sheet with every figure at its 26-distance size. Tiles are assembled with numpy and saved as JPEG quality 88 through `bpy.data.images`. Prints one line per sheet with path, seconds and pixel height.
- **Accept**: SHEETS on `public/models/hero.glb` with `--clips` and on `public/models/monsters.glb` exit 0 inside the timeout; every sheet is a JPEG under 400 kB; UNTOUCHED; SG.
- **Must not change**: build scripts.

### V2 Sheets are honest [CLAUDE]
- **Tier**: opus.
- **Depends**: V1.
- **Files**: `docs/superpowers/baseline/models/README.md` (new).
- **Change**: open the sheets from V1 and check them against known facts: the hero's printed heights are within 5% of 410, 260 and 85; the guard shows its T-pose; the `Walk` strip shows legs alternating; the `Slash` strip shows the right arm moving and its printed range is 1.84 rad within 0.05 (the GLB's own value); the `Idle` strip prints ranges under 0.07; the silhouette sheet is pure black on white. Write the README: how sheets are made, the exact command, and the "what a render proves and does not" table of design 7.3.
- **Accept**: the README exists; any mismatch is fixed in V1's script by a follow-up [AGY] task before V3.
- **Must not change**: anything outside `docs/superpowers/baseline/models/`.

### V3 Baseline sheets of everything [RUN], then [CLAUDE]
- **Tier**: haiku runs; opus writes the notes.
- **Depends**: V2.
- **Files**: `docs/superpowers/baseline/models/before/` (new).
- **Change**: SHEETS for hero (with clips), gear (the six shared silhouettes and five named pieces), monsters, guard. Commit them with a one-page note per file naming what the design's section 4 says is weak, so the owner can check the claim against the picture.
- **Accept**: at most 2 MB in total; UNTOUCHED.
- **Must not change**: anything outside `docs/superpowers/baseline/models/before/`.

### V4 In-engine "before" captures [CLAUDE] + [HUMAN]
- **Tier**: sonnet for the hook; the main session captures.
- **Depends**: R0 (Stage 5's `photo.ts`).
- **Files**: `src/engine/photo.ts` (add four poses to its table), `docs/superpowers/baseline/models/before-ingame/` (new).
- **Change**: poses `model-hero-close` (distance 5.4), `model-hero-play` (8.5), `model-guards` (the castle gate), `model-camp-<slice>` for the goblin camp, the dunes, the pass and the dragon's lair, hero held still, noon. Capture each as the Stage 2 captures were taken (`docs/superpowers/baseline/g4/README.md`), with a README that says the renderer was software.
- **Accept**: SG; eight JPEGs; the README.
- **Must not change**: any pose Stage 5 defined.

### H6 Vertex-colour test [CLAUDE] (only if CALL-M11; moved into slice 0 by the critique)
- **Tier**: sonnet.
- **Depends**: R0.
- **Files**: `tests/model-vertex-colour.test.ts` (new), `tests/fixtures/models/` (a tiny GLB with `COLOR_0` on every mesh, written by the test's helper).
- **Change**: `a hero whose file carries COLOR_0 gets vertexColors true on every role material, and rig.tunicMat is the material on the coat mesh` (recolouring by `playerMesh.ts` still reaches it); `a monster and a gear piece whose meshes carry a color attribute get materials with vertexColors true`; `today's GLBs produce no material with vertexColors`.
- **Accept**: red until H6b.
- **Must not change**: `src/`.

### H6b Vertex colour in the engine [AGY] (only if CALL-M11)
- **Tier**: sonnet.
- **Depends**: H6.
- **Files**: `src/engine/blenderHero.ts`, `src/engine/blenderMonsters.ts`, `src/engine/blenderGear.ts`.
- **Change**: hero: if any mesh of the cloned scene has a `color` attribute, create the role materials with `vertexColors: true` (one flag at creation; no second instance). Monsters and gear: pass `vertexColors: true` to the `facetMaterial` and `albedoMaterial` calls for a mesh whose geometry has a `color` attribute (each mesh already gets its own material, or one per family per gear clone; the manifest guarantees all or none per file).
- **Accept**: `ONE(tests/model-vertex-colour.test.ts)` passes; SG.
- **Must not change**: material choice by name; outline shells; `materials.ts`; `textures.ts`.

### OM-1 [OWNER]
Look at V3 and V4 and, if possible, the same places in the game on the owner's machine. Confirm the art direction or change it. The design's section 5 is amended before slice 1 if anything changes.

---

## Slice 0b: merge-only pass over the monsters (only if D-5)

### M0 Merge every monster builder's output [AGY]
- **Tier**: sonnet.
- **Depends**: H2, OM-1. (The fixture is computed by the same rule G2 uses for gear; the two tests are written independently.)
- **Files**: `scripts/blender/build_monsters.py` (one `figkit.merge_parts` call per `Monster_*` root before export), `tests/monster-merge.test.ts` (new, written and committed first by a [CLAUDE] sonnet step: triangles per engine material family per figure equal a fixture computed from today's file by the rule of `blenderMonsters.ts` 103-136; every pivot keeps its meshes' families; meshes per figure at most half today's), `tests/fixtures/monster-families.json` (new), `tests/fixtures/model-contract/monsters.json` (mesh ceilings).
- **Change**: merge only; no geometry, name, pivot or colour change.
- **Accept**: BG for monsters; `monster-merge.test.ts` green against the built file (throw-away worktree); mesh count reported (399 today; the goblin alone went 59 to 29 in design 3.3); CAPTURE(monsters) of the goblin camp beside V4's before.
- **Must not change**: everything but mesh grouping.

### M0p Promote monsters, merge only [CLAUDE, main session] + OM-S0b
- As M4a; the captures include the perf HUD's draw calls at the start pose and the goblin camp, before and after. **Depends**: M0.

---

## Slice 1: hero

### H1 Hero acceptance tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: OM-1.
- **Files**: `tests/hero-model.test.ts` (new).
- **Change**: against `public/models/hero.glb` (rotation range = largest angle between two keys of one channel, as the critique's E4 measured it): `every attack clip turns Torso by at least 0.3 rad` (today: `Slash` 0.90, `SpinSlash` 3.14, `Chop` 0.44, `Mine` 0.49, `Ranged` 0.55 pass; `Lunge` 0.24 and `Cast` 0.12 fail); `Idle turns Torso or HeadGroup by at least 0.08 rad` (today 0.03); `Walk turns Torso by at least 0.08 rad` (today 0.04); `Fish turns an arm by at least 0.3 rad` (today 0.10); `in Slash, Lunge, Chop and Mine the right arm's x rotation first moves against the strike before it strikes` (measured per key: `Slash` 0.11 to -0.62 then 0.95, `Chop` to -1.31 then 1.21, `Mine` to -1.34 then 1.19 pass; `Lunge` rises 0.10 to 1.15 with no wind-back and fails; `SpinSlash` holds the arm out while the torso spins and is excluded); `every limb pivot's child meshes overlap the parent's bounds at the joint by at least 0.02` (no gap at rest); `the worst pose of every clip keeps that overlap above 0` (sampled at 12 frames per clip); `the hand, foot and head centres stay within 0.01 of the manifest` (mount offsets); `the toggled names of design 8.1 exist as their own meshes`; `triangles at most 6,000, meshes at most 20`; `meshes carry COLOR_0` (skipped with a named reason if CALL-M11 is "no"); and the two frozen samples restated so they fail here first: `0.2 s into Walk a leg pivot's x rotation exceeds 0.01` and `0.15 s into Slash at time scale 1.2 the right arm's x rotation exceeds 0.05`.
- **Accept**: on today's file the cases marked "fail" above and `COLOR_0` are red; the overlap cases were not measured by the critique and are expected red (the knee band); the task runs the file once on today's GLB and **records the actual red list in the test file's header**, and any case that is green today but meant to drive work is reported to the verify; all green at H7.
- **Must not change**: `src/`, any existing test.

### H2 Figure kit [AGY]
- **Tier**: sonnet.
- **Depends**: P2.
- **Files**: `scripts/blender/figkit.py` (new), `scripts/blender/figkit_selftest.py` (new, asserts on a generated two-part figure and exits non-zero on failure).
- **Change**: `joint_cap(part, pivot, radius)`: adds a half-sphere of the part's material at the pivot so a rotated child never shows a hole. `merge_parts(root, keep=TOGGLED)`: joins meshes sharing parent, material, `noOutline` and name class (`eye`, `glow`, `gem`, `orb`, `string`, other), keeps a name in the class, keeps `extras`; **never merges a mesh whose name matches `TOGGLED`** (`^Hair`, `^CrownSpike_`, `^BackSpike_`, `^Sideburn_`, `^TorsoCoat$`, `^OuterCoat_`, `^CoatTrim_`, `^CoatTail_`, `^CoatTailTrim_`, `^InnerCollar$`, `_leg[LR]_04_`: today only `Gear_dhide-chaps_legL/R_04_` and `Gear_trousers_legL/R_04_`) and keeps the `_NN_` ordinals of those leg meshes unchanged; other gear `_04_` meshes (50 of 54) merge freely. `decimate_to(obj, triangles)`. `cut_by_weights(body, armature, bone_to_pivot)`: assigns each face to the bone with the largest summed vertex weight, separates per bone group, parents each part to the named pivot at its bone head, keeps world positions, caps each cut with `joint_cap`. `bake_paint(root, ao=0.35, gradient=0.15, warm_cool=0.05)`: Cycles CPU vertex bake of ambient occlusion (`bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')`) into a colour attribute named `Col` on the **`POINT` domain** (measured: no vertex added against a colour-free export of the same goblin, 15,976 both), multiplied by a height gradient and a front-to-back tint; with `--fast-paint` a crease-angle term replaces the ray-traced one. The exporter writes it as 16-bit `COLOR_0` whatever the attribute type (critique E5). `pose_rest(parts, table)` and `pose_armature(armature, table)`. `export_glb(path)` with `export_vertex_color='ACTIVE'`, `export_texcoords=False` (no figure reads GLB UVs, design K2; saves 8 bytes per vertex raw, which is parse time and memory; on the wire it saved only 3% on the goblin, 121,155 to 117,629, because box UVs compress well), `export_extras=True`, `export_yup=True`.
- **Accept**: the self-test exits 0 inside 60 s under CAP; the two-part figure exports with `COLOR_0`, no `TEXCOORD_0` and half the meshes; a mesh named `TorsoCoat` survives a merge alone; a cube weighted to two bones is cut into two parts under two pivots; the hero built with `export_texcoords=False` passes `ONE(src/__tests__/blender-hero.test.ts)` in a throw-away worktree (proves the engine needs no GLB UVs); SG; UNTOUCHED.
- **Must not change**: the four build scripts.

### H3a Hero joints [CLAUDE]
- **Tier**: opus.
- **Depends**: H1, H2.
- **Files**: `scripts/blender/build_hero.py`, `tests/fixtures/model-contract/hero.json` (hero budgets only).
- **Change**: to design 6.1: joint caps at shoulders, elbows, hips, knees and neck; the sleeve, thigh and shin cuts moved so each child overlaps its parent (today a light band shows at both knees). Nothing else.
- **Accept**: BG for hero; the H1 overlap cases green against the built file; `ONE(src/__tests__/blender-hero.test.ts)` green against the built file in a throw-away worktree where the built file is copied over the shipped one; worst-pose strips of `Walk`, `Lunge` and `Chop` `--against` the shipped file under `docs/superpowers/baseline/models/s1/`; CAPTURE(hero) of the two hero poses.
- **Must not change**: the ten pivot names and their `LEAN_RIG` positions; every `extras.part` value and mesh name the engine reads or toggles (design 8.1); hand, foot and head centres beyond 0.01; clip names; the body's bounds beyond 3% per axis.

### H3b Hero face, hands, hair, paint [CLAUDE]
- **Tier**: opus (fable if H3a was rejected once).
- **Depends**: H3a.
- **Files**: `scripts/blender/build_hero.py`, `tests/fixtures/model-contract/hero.json`.
- **Change**: to design 5.2 to 5.4: hands 15% larger **about their own centre** (the mount offsets hold); the face given planes that read at 260 px (brow, nose, jaw; eyes kept as their own meshes); hair as three or four large locks, still named `Hair*`; `merge_parts` with the toggled names kept; `bake_paint`.
- **Accept**: BG; turnaround and silhouette sheets `--engine-palette --against` the shipped file under `s1/`; **a turnaround of the built body wearing today's plate set** (full helm, plate body, plate legs, gloves, boots from the shipped `gear.glb`, mounted with the offsets of `playerMesh.ts`) showing no hand, hair or limb poking through and no floating glove or boot; CAPTURE(hero).
- **Must not change**: as H3a.

### H4a Motion spike: one attack and Idle [CLAUDE] + OM-H4a
- **Tier**: opus.
- **Depends**: H3a.
- **Files**: `scripts/blender/build_hero.py`, `tests/fixtures/model-contract/hero.json`.
- **Change**: replace the sample functions of `Slash` and `Idle` only with pose tables (pose, frame on a 12-a-second grid, easing) sampled by one function. `Slash` keeps its wind-back and adds hip and chest lead and a settle; `Idle` gains a weight shift, breath and a look. Built twice: interpolated (`LINEAR`, sampled at 24 a second) and held (`STEP` at 12 a second).
- **Accept**: BG for both builds; H1's `Idle` case and the two frozen samples green on both; motion strips (corrected method) under `s1/`; CAPTURE(hero) of both builds, and **the owner plays both on a real GPU** (OM-H4a answers D-4). If neither beats today's `Slash` for the owner, today's attack clips stay and H4b re-authors only the clips H1 marks weak.
- **Must not change**: as H4b.

### H4b Hero motion, the rest [CLAUDE]
- **Tier**: opus.
- **Depends**: OM-H4a.
- **Files**: `scripts/blender/build_hero.py`, `tests/fixtures/model-contract/hero.json` (hero clips: the two frozen samples for every promotion; `Hurt` and `Death` only if CALL-M6).
- **Change**: in the style D-4 chose, the clips H1 marks weak (`Walk` torso counter-rotation and a level head, `Fish`, `Lunge`, `Cast` torso lead), and attack clips only where the corrected strip shows no body lead. Clip lengths stay within 10% of today's so `playAction` time scales still fit (`blenderHero.ts` 91-103). If CALL-M6: add `Death` (1.1 s, ends lying, last pose held) and, if taken, `Hurt` (0.35 s).
- **Accept**: BG; every H1 motion case green against the built file, **including the two frozen samples**; motion strips for all clips under `s1/`; the opus verify names the frame of each of the three beats in every attack strip; CAPTURE(hero).
- **Must not change**: the ten clip names; `Walk` turning a leg pivot past 0.01 rad by 0.2 s; `Slash` turning the right arm past 0.05 rad on x by 0.15 s at time scale 1.2; clip lengths beyond 10%.

### H5 Clip wiring test [CLAUDE] (only if CALL-M6)
- **Tier**: sonnet.
- **Depends**: H4b; Stage 4's event names from R0.
- **Files**: `tests/hero-clips.test.ts` (new); the **declared replacement** of `src/__tests__/blender-hero.test.ts` lines 39-42 (design 8.3): the ten names are all present, and the full list equals the manifest's hero clips.
- **Change**: tests: `Death plays once and clamps on the last pose`; `Hurt plays only when no one-shot is active`; `a running attack is never interrupted by Hurt`; `Stage 4's torso lean and knock-back offsets are still applied while Hurt plays` (the offsets are read from the rig after one update).
- **Accept**: red until H5b.
- **Must not change**: every other assertion in `blender-hero.test.ts`.

### H5b Wire the clips [AGY] (only if CALL-M6)
- **Tier**: sonnet.
- **Depends**: H5.
- **Files**: `src/engine/blenderHero.ts`, the engine file where Stage 4 handles a heavy hit taken and `handlePlayerDeath` in `src/engine/actions.ts`.
- **Change**: `HeroClipName` gains `Death` (and `Hurt`). `handlePlayerDeath` plays `Death`; `finishRespawn` returns to `Idle`. `Hurt` is requested on a heavy hit taken and dropped if a one-shot is active.
- **Accept**: `ONE(tests/hero-clips.test.ts)` passes; SG.
- **Must not change**: Stage 4's timings in `feel.ts`; respawn timing; the death overlay.

(H6 and H6b moved to slice 0 by the critique.)

### H7 Promote hero [CLAUDE, main session] + OM-S1
- **Tier**: sonnet runs the commands; opus reads the compare report and the sheets.
- **Depends**: H3b, H4b, H5b, H6b.
- **Files**: `public/models/hero.glb`, `blender/hero.blend` (CALL-M10), `src/engine/blenderHero.ts` (the `?v=` key only), `tests/fixtures/model-contract/hero.json` (hero ceilings lowered to the built values plus 2%), `tests/model-cache-key.test.ts` (new), `docs/superpowers/baseline/models/s1/`.
- **Change**: BLEND(hero), COMPARE, promote, set the key to the hash prefix, add the cache-key test (key equals hash prefix for every loader that has one), SHEETS `--against` the old file, in-engine captures of the two hero poses.
- **Accept**: SG; `ONE(tests/hero-model.test.ts)` green; wire size of `hero.glb` at most 200,000; sheets at most 2 MB. Then **OM-S1**.
- **Must not change**: any other file under `public/models/` or `blender/`.

---

## Slice 2: gear

### G1 Band table and tests [CLAUDE]
- **Tier**: sonnet (the rule is mechanical: level requirement in three even groups); the opus verify reads the printed table for items that land oddly.
- **Depends**: OM-1.
- **Files**: `src/data/gearBands.ts` (new, pure), `tests/gear-bands.test.ts` (new).
- **Change**: `gearBand(item): 1 | 2 | 3`, from a table keyed by item id for every equippable item whose silhouette is one of the shared ones (found by running `gearSilhouette` over `ITEMS`; expected: `helm`, `plate-body`, `platelegs`, `kiteshield`, `scimitar`, `sword`; the test prints the real list). Bands follow the item's level requirement in three even groups; named unique pieces are not in the table. Tests: every such item has a band; bands never decrease as the requirement rises within one slot; no import of `three`.
- **Accept**: `ONE(tests/gear-bands.test.ts)` passes; SG.
- **Must not change**: `ITEMS`, any stat or name.

### G2 Merge test [CLAUDE]
- **Tier**: sonnet.
- **Depends**: P4.
- **Files**: `tests/gear-merge.test.ts` (new), `tests/fixtures/gear-families.json` (new: triangles per engine material family per node, computed from today's file by the rule of `blenderGear.ts` 93-116).
- **Change**: for every `Gear_*` node of the shipped file, triangles per material family equal the fixture; meshes per node at most 4, except nodes whose fixture has more than 4 families.
- **Accept**: the family case passes today; the mesh-count case is red until G6.
- **Must not change**: `src/`.

### G2b Merge gear meshes [AGY]
- **Tier**: sonnet.
- **Depends**: G2, H2.
- **Files**: `scripts/blender/build_gear.py` (one call per root before export).
- **Change**: call `figkit.merge_parts` on every `Gear_*` root (toggled names and `_04_` ordinals kept, H2).
- **Accept**: BG for gear; `gear-merge.test.ts` green against the built file (throw-away worktree); `ONE(src/__tests__/blender-hero.test.ts)` green there too; mesh count reported (506 today); CAPTURE(gear) of the hero in a full plate set and in the bandos set (projected albedo tiles shift on merged parts, critique M2).
- **Must not change**: geometry, node names, materials, mount space.

### G3 Gear to budget [CLAUDE]
- **Tier**: opus.
- **Depends**: G2b.
- **Files**: `scripts/blender/build_gear.py`, manifest (gear budgets).
- **Change**: bring every piece inside design 9.1: fewer segments on lathes and tubes where the outline does not change at 260 px; the three third-party blades and the shield get clean rebuilt edges; nothing thinner than 0.044; `bake_paint`.
- **Accept**: BG; no piece over its budget; turnaround sheets `--against` shipped for the fifteen heaviest pieces under `s2/`.
- **Must not change**: node names, materials, bounds beyond 5% per axis (the pieces must still fit the body).

### G4 Band shapes [CLAUDE]
- **Tier**: opus.
- **Depends**: G1, G3.
- **Files**: `scripts/blender/build_gear.py`, manifest (new nodes).
- **Change**: for each shared silhouette, new nodes with `_b2` and `_b3` appended after any part suffix (`Gear_helm_b2`, `Gear_plate-body_torso_b3`, `Gear_platelegs_legL_b2`), to design 5.5: band 2 adds one forged form, band 3 a crest, wings or horns that break the outline, plus trim and one glow gem. The base node is band 1 and is simplified toward "plain".
- **Accept**: BG; a silhouette sheet of the hero body wearing each band under `s2/`, where the three outlines differ at the 85 px size.
- **Must not change**: band 1 node names and mount space; the eight material names.

### G5 Band lookup test [CLAUDE]
- **Tier**: sonnet.
- **Depends**: G1, G4.
- **Files**: `tests/gear-band-nodes.test.ts` (new), `tests/fixtures/models/gear-bands.glb` (new, tiny: one base node, one `_b3` node).
- **Change**: `a band 3 item clones the _b3 node`; `a band 2 item with no _b2 node falls back to the base node`; `a named unique piece is unchanged`; `gearSilhouette returns what it returned before for every item` (snapshot taken in this test from today's function).
- **Accept**: red until G5b.
- **Must not change**: `src/`.

### G5b Pick the band in the engine [AGY]
- **Tier**: sonnet.
- **Depends**: G5.
- **Files**: `src/engine/playerGear.ts`.
- **Change**: where a `Gear_<silhouette>…` node name is formed, try the name with the band suffix first when `gearBand(item) > 1`, then the base name. Nothing else.
- **Accept**: `ONE(tests/gear-band-nodes.test.ts)` passes; SG.
- **Must not change**: `gearSilhouette`'s return values; the procedural fallbacks; `blenderGear.ts`.

### G6 Promote gear [CLAUDE, main session] + OM-S2
- **Tier**: sonnet runs; opus reads the report and the sheets.
- **Depends**: G2b, G3, G4, G5b, H7.
- **Files**: `public/models/gear.glb`, `blender/gear.blend`, `src/engine/blenderGear.ts` (the `?v=` key only), manifest (gear ceilings), `docs/superpowers/baseline/models/s2/`.
- **Change**: as H7; captures of the hero poses in a band 1, a band 2 and a band 3 set.
- **Accept**: SG; wire size of `gear.glb` at most 900,000; `gear-merge.test.ts` fully green. Then **OM-S2**.
- **Must not change**: any other shipped file.

---

## Slice 3: guards

### N1 Guard tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: R0, G2b (the gear merge; without it a guard costs 62 draw calls instead of the knight's 27).
- **Files**: `tests/guards.test.ts` (new).
- **Change**: `createCastleGuard` produces, for both guards: the same position, the same `npcList` label and dialogue text, a hitbox of the same size, `userData` keys unchanged (values read from today's code and written into the test), a rig flagged `isBlenderHero` once the hero template resolves, and no request for `guard.glb` (the loader stub records URLs); `mountLoadout` given the player's equipment mounts the same nodes at the same positions as today's `rebuildPlayerEquipmentMeshes` (snapshot taken in this test from today's function before N2); meshes per guard at most 35.
- **Accept**: red until N2.
- **Must not change**: `src/`.

### N2 Guards from the hero and gear [AGY]
- **Tier**: sonnet.
- **Depends**: N1, CALL-M2 answered (a).
- **Files**: `src/engine/worldBuild.ts`, `src/engine/playerMesh.ts` (the mounting part of `rebuildPlayerEquipmentMeshes` moved, unchanged, into an exported `mountLoadout(rig, items)`; the player calls it), `public/models/guard.glb` (delete), `scripts/blender/export_guard.py` (delete), `scripts/run-blender.mjs` and `package.json` (remove the guard mode), `tests/fixtures/model-contract/guard.json` (delete) and `totals.json`, `tests/model-pipeline.test.ts` (the one `guard is a mode` case, created by this plan, removed).
- **Change**: design 10.3. `loadBlenderGuardTemplate` is deleted. The guard is built the way the merchant is (`createMerchantNPC`, `worldBuild.ts` 504), dressed through `mountLoadout` with the full helm, plate body, plate legs, kite shield and sword visuals in guard steel `0x80898f` with gold trim, and plays `Idle`. No mount offset is copied.
- **Accept**: `ONE(tests/guards.test.ts)` passes; `test ! -e public/models/guard.glb`; `ONE(tests/credits.test.ts)` green untouched; SG.
- **Must not change**: guard positions, dialogue, hitbox, labels; the player's mounted offsets; `blender/examples/knight_28541/`.

### N3 Credits and capture [CLAUDE]
- **Tier**: sonnet.
- **Depends**: N2.
- **Files**: `CREDITS.md`, `docs/superpowers/baseline/models/s3/`; if D-3 is "delete", also `blender/examples/knight_28541/knight.blend` (delete; `LICENSE.txt` stays, its "Used by" lines updated).
- **Change**: move the knight's row to a "kept in the repository, not shipped" part (or, with D-3, "source removed; credit kept"), keeping the words `tests/credits.test.ts` reads. In-engine capture of `model-guards`, with the perf HUD's draw calls at the gate before and after.
- **Accept**: `ONE(tests/credits.test.ts)` and `ONE(tests/model-licences.test.ts)` pass; SG. Then **OM-S3**.
- **Must not change**: every other credit row; the licence files.

### N-alt Keep the knight, reduced [AGY] (only if CALL-M2 is (b); replaces N1 to N3)
- **Tier**: sonnet.
- **Depends**: H2, P5.
- **Files**: `scripts/blender/export_guard.py`, manifest (guard budgets); promotion by the main session as H7 (`public/models/guard.glb`, a `?v=` key added in `worldBuild.ts`).
- **Change**: join by material, `decimate_to` 6,000 in total, pose the arms down and the sword at rest.
- **Accept**: BG with the guard at 6,000 triangles, 2 meshes and at most 300,000 wire bytes; sheets `--against` shipped; SG.
- **Must not change**: the node name `CastleGuard`, the two material names, the height 1.85.

---

## Slice 4: monsters

### M1 Pose table test [CLAUDE]
- **Tier**: sonnet.
- **Depends**: R0.
- **Files**: `tests/monster-poses.test.ts` (new).
- **Change**: `every model key has a row`; `for each key, the pivot rotations and body lift at progress 0, 0.5 and 1 equal the old branch's` (the old numbers of `monsterMeshes.ts` 813-843 written into the test); `a rig with no optional pivots poses without error`; `the table imports nothing from three`.
- **Accept**: red until M1b.
- **Must not change**: `src/`.

### M1b Pose table [AGY]
- **Tier**: sonnet.
- **Depends**: M1.
- **Files**: `src/data/monsterPoses.ts` (new, pure), `src/engine/monsterMeshes.ts`, `src/engine/blenderMonsters.ts` (optional pivot lookup only).
- **Change**: the attack branch of `poseMonsterLimbs` and Stage 4's wind-up pose read a row per model key: which pivots turn, on which axis, by how much at full progress, and the body lift. The rows reproduce today's numbers exactly. Optional pivots `Jaw`, `TailPivot`, `TailPivot2`, `WeaponPivot`, `LeftElbowPivot`, `RightElbowPivot` are found by `findPivot` and skipped when absent. M1 and M1b run before slice 5 (the dragon's new pivots need rows).
- **Accept**: `ONE(tests/monster-poses.test.ts)` passes; SG.
- **Must not change**: flinch, walk and idle numbers; Stage 4's reaction timings; the seven existing pivot fields.

### M2 One pattern figure: the goblin raider [CLAUDE]
- **Tier**: **fable** (the pattern eight more figures follow); opus verifies.
- **Depends**: H2, H7 (the paint layer judged on the hero first), M1b, D5 if D-2 is accepted.
- **Files**: `scripts/blender/build_monsters.py` (the goblin base and raider), `tests/fixtures/model-contract/monsters.json` (goblin budgets, optional pivots, the per-figure wire ceiling).
- **Change**: rebuild to design section 5: hunched line of action, big ears and jaw, one tapered torso, joint caps, the spear and shield outside the outline, olive at 30 to 45% value with a bone and rust accent, five materials, optional `Jaw` and `WeaponPivot`, `merge_parts`, `bake_paint`. Budget: 5,000 triangles, 14 meshes. **Built two ways** (design 6.2): (a) primitives with joint caps; (b) a skin modifier over a stick graph, voxel remesh, smooth, `decimate_to` 5,000, cut at the pivots; the same head, gear and palette on both.
- **Accept**: BG for each; all five sheets of both `--against` shipped under `s4a/`; CAPTURE(monsters) of both at the goblin camp; the figure's measured Brotli bytes for each, and **the per-figure wire ceiling for every later monster set from the chosen one** (critique H5); a short written pattern (what was done, in order, with the kit calls) appended to `docs/superpowers/baseline/models/README.md`. The owner picks (a) or (b) at OM-S4-pattern.
- **Must not change**: `Monster_goblin`, its seven pivot names and positions within 0.05, material name substrings, in-game height within 5%; every other builder.

### OM-S4-pattern [OWNER]
Look at the goblin sheets and an in-engine capture taken from a throw-away worktree. This sets the pattern for eight more figures; a change here is cheap, later it is not.

### M3a Chicken and goblin archer [CLAUDE]
- **Tier**: opus.
- **Depends**: OM-S4-pattern.
- **Files**: `build_monsters.py` (those two builders), manifest.
- **Change**: the archer gets its own outline against the raider: ears through the hood, a lighter value, the bow held out to the side, a tall quiver. The chicken keeps its shape and loses meshes (2,500 triangles, 8 meshes).
- **Accept**: BG; sheets under `s4a/`; the roster silhouette sheet shows raider and archer told apart at 85 px.
- **Must not change**: the two node names, their pivot names and positions within 0.05, material name substrings, in-game height within 5%; every other builder.

### M4a Promote monsters, slice 4a [CLAUDE, main session] + OM-S4a
- **Tier**: sonnet runs; opus reads the report and the sheets.
- **Depends**: M2, M3a.
- **Files**: `public/models/monsters.glb`, `blender/monsters.blend`, `src/engine/blenderMonsters.ts` (the `?v=` key only), manifest (ceilings), `docs/superpowers/baseline/models/s4a/`.
- **Change**: as H7; in-engine capture of the goblin camp.
- **Accept**: SG; the seven untouched figures show zero Drift in the compare report. Then **OM-S4a**.
- **Must not change**: any other shipped file.

### M3b Scorpion, dark wizard, dark ranger [CLAUDE]
- **Tier**: opus.
- **Depends**: M4a.
- **Files**: `build_monsters.py` (those three), manifest.
- **Change**: scorpion: legs at least 0.044 thick, a `TailPivot` chain of two, ochre and bone values, 5,000 triangles. Wizard: hat and sleeves exaggerated, the staff held away from the body on a `WeaponPivot`. Ranger: a cloak that makes a triangle outline, bow out, a value clearly lighter than the wizard's.
- **Accept**: BG; sheets under `s4b/`; the three told apart from each other and from the goblins on the roster sheet.
- **Must not change**: as M3a, for these three.

### M4b Promote monsters, slice 4b [CLAUDE, main session] + OM-S4b
- As M4a (same tier, files, accept and must-not-change), sheets under `s4b/`, capture of the dunes camp. **Depends**: M3b.

### M3c Hill giant, moss guardian [CLAUDE]
- **Tier**: opus.
- **Depends**: M4b.
- **Files**: `build_monsters.py` (those two), manifest.
- **Change**: giant: shoulders and hands exaggerated, the club carried at the side on a `WeaponPivot`. Guardian: stone and bark separated in value by 20 points, the core kept as the one glow.
- **Accept**: BG; sheets under `s4c/`; CAPTURE(monsters).
- **Must not change**: as M3a, for these two.

### M3d Lesser demon: cut by its armature, out of the T-pose [CLAUDE]
- **Tier**: opus.
- **Depends**: M3c, D2a (the cut method proven on the dragon).
- **Files**: `build_monsters.py` (the demon builder), manifest.
- **Change**: `pose_armature` on `RedDevil-Ex.blend`'s `Armature` (arms down and forward, a hunch), then `cut_by_weights` onto `HeadGroup`, both arm and both leg pivots (today all but the right arm are empty, critique C1), joint caps; body `decimate_to` 5,000; wings centred on the back; 7,000 triangles in total.
- **Accept**: BG; `tests/monster-motion.test.ts` (D2a) green for the demon against the built file; turnaround, worst-pose and silhouette sheets under `s4c/`; CAPTURE(monsters) at the pass; the roster silhouette sheet shows all ten told apart (GM6).
- **Must not change**: as M3a; the demon's CC0 source file and its credit row.

### M4c Promote monsters, slice 4c [CLAUDE, main session] + OM-S4c
- As M4a, sheets under `s4c/`, capture of the pass. **Depends**: M3d.

---

## Slice 5: dragons (runs before slice 4a if D-2 is accepted)

(D1 was cut: the critique's E6 measured that linked mesh data exports once, and kits no longer need it.)

### D1b Kit over a base model [CLAUDE] test, then [AGY]
- **Tier**: sonnet for both.
- **Depends**: R0, M1b.
- **Files**: `tests/monster-kits.test.ts` (new, written and committed first), then `src/engine/blenderMonsters.ts`, the file holding `MonsterDef` (named by R0; one optional look field `kit?: string`), the engine call site that passes the def (named by R0).
- **Change**: test: `a def with kit clones its model's Monster_ node, then adds the children of Kit_<kit> under the base pivots of the same name (a child named after no pivot goes under the root)`; `pivots resolve from the base`; `a def without kit is unchanged`; `the model key is unchanged, so Stage 4's tests over model keys still see ten`. Then the implementation, in `upgradeMonsterRigWithGltf` only.
- **Accept**: `ONE(tests/monster-kits.test.ts)` passes; Stage 4's amended `blender-hero.test.ts` and `new-monsters.test.ts` pass untouched; SG.
- **Must not change**: material rules; Stage 4's `tint`, `modelScale` and `model`.

### D2a Dragon cut by its armature [CLAUDE]
- **Tier**: opus.
- **Depends**: H2, M1b; M0p if D-5.
- **Files**: `build_monsters.py` (the dragon builder; `build_monsters.py` 190-200 today forces the rest pose and drops the rig), `tests/monster-motion.test.ts` (new, written first in this task: `every contract pivot of every Monster_ figure in the file holds at least one mesh`, `the dragon's Jaw and TailPivot exist and hold meshes`; red on today's file for the dragon and the demon), manifest (new pivots), `src/data/monsterPoses.ts` (the dragon's row gains `Jaw` and tail turns).
- **Change**: keep `Dragon-low-rig.blend`'s `Armature.001`; `pose_armature` to a crouched rest pose; `cut_by_weights` onto `HeadGroup` (head and neck), `Jaw`, the four leg pivots, `LWing`, `RWing`, `TailPivot`, `TailPivot2`; joint caps. No reduction yet.
- **Declared**: M1's case "the pivot rotations equal the old branch's" holds for every row except the dragon's, whose numbers were never seen on a mesh (its pivots were empty); this task may retune that row, and the M1 test's dragon row is replaced in the same commit. M3d may do the same for the demon's row.
- **Accept**: BG; `monster-motion.test.ts` green for the dragon against the built file; worst-pose strips of the attack, walk and Stage 4 wind-up poses under `s5/`; CAPTURE(monsters) at the dragon's lair with the dragon attacking.
- **Must not change**: `Monster_elvarg_dragon`, its seven pivot names, its in-game size; the CC-BY source file and its credit row.

### D2b Dragon to budget, dressed [CLAUDE]
- **Tier**: opus.
- **Depends**: D2a.
- **Files**: `build_monsters.py` (the dragon builder), manifest.
- **Change**: body parts `decimate_to` 9,000 in total (25,182 today); the two teeth meshes (8,928 triangles) replaced by two procedural rows of at most 400 triangles in total; eyes kept (640, reduced to 200); belly, back and wing membrane as separate named materials at different values; `bake_paint` **only once OM-S1 has accepted the paint layer on the hero** (if D-2 puts this task first, the dragon ships unpainted at D5 and is painted in the next monster promotion). 14,000 triangles, 20 meshes.
- **Accept**: BG; the five sheets `--against` shipped under `s5/`; wire bytes of the figure reported (target at most 420,000); CAPTURE(monsters).
- **Must not change**: as D2a.

### D3 Ashmantle kit [CLAUDE]
- **Tier**: opus.
- **Depends**: D1b, D2b.
- **Files**: `build_monsters.py`, manifest (node `Kit_ashmantle`).
- **Change**: design 5.6: a slag crown, back plates with emissive seams (the `glow` material), a clubbed tail end, each a child of `Kit_ashmantle` named after the dragon pivot it rides on; at most 3,000 kit triangles. Value and size stay Stage 4's `tint` and `modelScale`.
- **Accept**: BG; silhouette sheet of dragon and Ashmantle (base plus kit, at `modelScale` 1.2) side by side at 85 px: different outlines.
- **Must not change**: the dragon's own node; every other builder.

### D4 Model and kit test [CLAUDE]
- **Tier**: sonnet.
- **Depends**: D3.
- **Files**: `tests/monster-models.test.ts` (new).
- **Change**: `every MONSTER_TYPES row's model key (or type key) has a Monster_ node with both leg pivots`; `every row's kit, if any, has a Kit_ node whose children name pivots of that model`; `no row's stats or model key differ from a snapshot taken in this test` (name, level, hitpoints, max hit, attack, defence, drops, model).
- **Accept**: red for the three kits until K3 and the promotions.
- **Must not change**: `src/`.

### D5 Promote monsters, slice 5 [CLAUDE, main session] + OM-S5
- As M4a, sheets under `s5/`, captures of both lairs. **Depends**: D2b, D3.

---

## Slice 6: variants

### K1 Saltback Stalker kit [CLAUDE]
- **Tier**: opus.
- **Depends**: D1b, M4b.
- **Files**: `build_monsters.py`, manifest (node `Kit_saltback_stalker`).
- **Change**: design 5.6: salt-crusted back plates, a forked double sting, heavier claws; at most 1,200 kit triangles; values 15 points from the scorpion's.
- **Accept**: BG; scorpion and stalker side by side at 85 px: different outlines.
- **Must not change**: `Monster_scorpion`; every other builder.

### K2 Thornwatch Marksman kit [CLAUDE]
- **Tier**: opus.
- **Depends**: K1 (same file, serial).
- **Files**: `build_monsters.py`, manifest (node `Kit_thornwatch_marksman`).
- **Change**: a thorn-wreathed hood, a tall bramble quiver, a longer bow; at most 1,200 kit triangles.
- **Accept**: BG; ranger and marksman side by side at 85 px: different outlines.
- **Must not change**: `Monster_dark_ranger`; every other builder.

### K3 Give the three rows their kits [AGY]
- **Tier**: sonnet.
- **Depends**: K2, D4.
- **Files**: the file(s) holding Stage 4's three `MONSTER_TYPES` rows (named by R0).
- **Change**: `kit` becomes `ashmantle`, `saltback_stalker` and `thornwatch_marksman`. Nothing else (D4b merged here).
- **Accept**: TYPES passes; the snapshot of D4 passes (stats and model keys unchanged); Stage 4's tests pass untouched.
- **Must not change**: every other field, including `model`, `tint` and `modelScale`; every other row.

### K4 Promote monsters, slice 6 [CLAUDE, main session] + OM-S6
- As M4a, sheets under `s6/`. The roster silhouette sheet now holds thirteen figures, all told apart (GM6). **Depends**: K3.

---

## Slice 7: budgets, hand-off

(L1 and L1b, the detail layer, were cut by the critique, M7.)

### X1 Shape studies for the three future monsters [CLAUDE] (only if D-6 keeps them)
- **Tier**: opus.
- **Depends**: M4c.
- **Files**: `scripts/blender/studies.py` (new; writes only to the output directory, never part of `all`), `docs/superpowers/baseline/models/studies/` (new), the design's hand-off section.
- **Change**: block-outs from kit primitives, no paint: a camp captain that reads as a leader beside a hill giant (banner or crest above the head line, one heavy asymmetric shoulder); a swarm creature under 60 px tall at play distance with a fast low outline; a dungeon boss that is not a dragon (upright, wide, a silhouette no existing figure has). Silhouette and play-distance sheets, each beside the figures it must be told apart from. A size, budget class and pivot list per study.
- **Accept**: three sheets; UNTOUCHED.
- **Must not change**: anything under `public/`, `src/`, the manifest.

### X2 Final budgets [CLAUDE]
- **Tier**: sonnet.
- **Depends**: all promotes.
- **Files**: `tests/fixtures/model-contract/*.json`.
- **Change**: set every ceiling to design 9.1 and 9.2: per-figure triangles and meshes, per-file wire bytes, total at most 2,850,000.
- **Accept**: `ONE(tests/model-contract.test.ts)` passes; SG. If a ceiling does not hold, the figure is fixed, not the ceiling; a ceiling is raised only by an owner decision recorded in the design's review log.
- **Must not change**: contract entries (names, pivots, clips); any GLB.

### X3 Final check [CLAUDE] + [HUMAN] + OM-F
- **Tier**: opus.
- **Depends**: X2 (and X1 if kept).
- **Files**: `docs/superpowers/baseline/models/final.md` (new), `README.md` (model and credits lines only).
- **Change**: SG; P5 repeated (a full rebuild compares clean against what is now shipped); the after sheets and captures indexed beside the before ones; per-file `curl -H 'Accept-Encoding: br'` sizes from the preview deployment [HUMAN]; Stage 5's start-pose draw calls and triangles re-captured and set against its budget; the owner plays ten minutes on a real GPU and walks the four camps.
- **Accept**: wire total at most 2.85 MB measured on the preview; Stage 5's budgets still hold; **OM-F**.
- **Must not change**: `src/`, any GLB, any test.

---

## Order and parallelism

```
OM-0 -> R0 -> P1 -> (P2 | P3) -> P4 -> P5 -> V1 -> V2 -> V3, V4 -> (H6 -> H6b) -> OM-1
hero cluster:     OM-1 -> H1, H2 -> H3a -> H4a -> OM-H4a -> H4b ; H3a -> H3b ; (H4b -> H5 -> H5b) -> H7 -> OM-S1
gear cluster:     OM-1 -> G1 ; H2 -> G2 -> G2b -> G3 -> G4 -> G5 -> G5b -> G6 -> OM-S2
guards:           G2b -> N1 -> N2 -> N3 -> OM-S3
monster cluster:  OM-1 -> M1 -> M1b ; H2 -> M0 -> M0p -> OM-S0b
                  -> D1b -> D2a -> D2b -> D3 -> D4 -> D5 -> OM-S5                      (first, if D-2)
                  -> H7 -> M2 -> OM-S4-pattern -> M3a -> M4a -> M3b -> M4b -> M3c -> M3d -> M4c
                  -> K1 -> K2 -> K3 -> K4
close:            all -> (X1 if D-6 keeps it) -> X2 -> X3 -> OM-F
```

About 56 tasks: 11 in slice 0 (with H6, H6b), 2 in slice 0b, 11 hero, 8 gear, 3 guards, 9 monsters, 6 dragons, 4 variants, 3 closing, plus R0. The art tasks (H3a, H3b, H4a, H4b, G3, G4, M3a to M3d, D2a, D2b, D3, K1, K2, X1) are opus, and M2 is fable with an opus verify; pipeline, wiring and merging are agy with a sonnet fallback; runs are haiku.

## Risks to the plan

| Risk | Answer |
|---|---|
| The paint layer fails in engine at H7. | H6b's flag stays harmless; every `bake_paint` call is dropped (0.5); budgets get easier (the layer costs about 26% of a figure's wire bytes), nothing else moves. |
| The goblin pattern is rejected at OM-S4-pattern. | Only M2 is redone; that is why one figure goes first. |
| `monsters.glb` is promoted six or seven times (with M0p) and the repository grows by about 25 MB of history. | Accepted; fewer promotions would mean larger, harder reviews. |
| An art task runs long because a look cannot be reached by script. | The task stops at its sheets and goes to the owner with the fallback of CALL-M8. |
| A slice's worktree promotes against a stale manifest. | Rule 0.4: promotions happen on the merged head, one at a time, by the main session. |
| Cutting a third-party body by bone weights leaves ragged seams or a part under the wrong pivot (D2a, M3d). | `monster-motion.test.ts` catches empty pivots; worst-pose strips and the capture catch seams; fallback is D-1's skinned route, a stage of its own. |
| The merge shifts the look of the engine's projected albedo tiles (critique M2). | Every merge promotion (M0p, G6) is judged on an in-engine capture; the material-family tests do not judge the look. |
| Stage 4's model-key tests break. | Model keys never change; kits are a separate field (D1b, K3), and D1b's accept runs Stage 4's tests untouched. |

---

## Review log

Review of 2026-11-14 by an independent critic: `docs/superpowers/specs/2026-11-14-models-pass-critique.md` (READY-WITH-FIXES).

| # | Change to this plan | Why |
|---|---|---|
| C1 | D2 split into D2a (cut by armature, `tests/monster-motion.test.ts` first) and D2b (reduce, dress); M3c split, demon in M3d with its cut; slice 5 may run before slice 4 (D-2) | The dragon and demon bodies sit outside their pivots and do not move |
| C2 | V1 clears each pivot's active action; V2 checks the `Slash` arm range; H1's cases restated from measurement; H4 split into the H4a spike (OM-H4a, D-4) and H4b | The motion strip showed `Idle`; today's attack clips already have three beats |
| C3 | H2's `merge_parts` keeps toggled names and `_NN_` ordinals; manifest holds them and the hand, foot and head centres; H3 split into H3a and H3b with mount checks | `playerMesh.ts` hides meshes by name and mounts gear at fixed offsets |
| C4 | D1 cut; D1b is the `kit` field and `Kit_<name>` nodes; D3, K1, K2 write `Kit_` nodes; D4b merged into K3, which sets `kit`, never `model`; rule 0.3.9 updated | Changing model keys breaks Stage 4's tests |
| H1 | COMPARE: Contract is built against manifest, Drift is built against shipped; P1 cases updated | Art tasks could never pass a 0.0001 contract against the shipped file |
| H2 | Manifest is one file per GLB; H6 and H6b moved to slice 0; clusters named with their files (0.4) | Parallel worktrees edited the same files |
| H3 | CAPTURE command; every art task ends with an in-engine capture before promotion; `--engine-palette` in V1 | The hero's colours exist only in code; its first in-game look came after promotion |
| H4 | N1 depends on G2b; `mountLoadout` shared, not copied (N2) | A hero-built guard costs 62 calls before the gear merge |
| H5 | H2 exports without `TEXCOORD_0` and proves the engine needs none; M2 sets a per-figure wire ceiling | Organic figures compress far worse than today's boxes |
| H6 | M2 builds the goblin two ways and runs on fable | The form ceiling of primitives decides the "8k" bar |
| M1 | P1 and P2 close `--render`, `export`, add `--factory-startup` | Unclosed write targets; a missing flag the design claimed |
| M5 | P4's licence test covers the Kai zip | It only looked at directories |
| M7 | L1 and L1b cut; detail tagging removed from H2, G3, M2, D2 | The detail layer adds calls up close and saves only triangles |
| M9 | G1 on sonnet | Mechanical banding |
| M10 | New slice 0b: M0 and M0p | Earliest draw-call gain |
| D-3, D-6 | N3 can delete `knight.blend`; X1 is conditional | Owner decisions |
| H9 | D2b paints only after OM-S1; D2a and M3d may retune the dragon and demon pose rows (declared) | Paint judged on the hero first; those numbers were never seen on a mesh |
| Scope | `--factory-startup` only on background spawns; the `_04_` merge exception only on `_leg[LR]_` nodes; H1 records its own red list | `open` is a GUI spawn; 50 of 54 `_04_` meshes are not hidden by anything; overlap cases were not measured |
