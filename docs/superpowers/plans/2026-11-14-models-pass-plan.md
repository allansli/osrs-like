# Models pass: implementation plan

Date: 2026-11-14. Branch: `feat/models-pass`. Design: `docs/superpowers/specs/2026-11-14-models-pass-design.md` (called "the design" below; section numbers refer to it). Source line numbers are at commit `5caa597`.

The owner answered the design's decisions on 2026-11-14 (design 13.1): **every figure is a skinned mesh on a skeleton**, the dragon is a new model, monsters are rebuilt where needed, motion is smooth. This plan was re-cut for those answers (review log at the end). Nothing starts before owner step **OM-0** (section 0.5: the four new decisions N-1 to N-4), and nothing starts before Stages 4 and 5 are merged to `main` (task R0).

---

## 0. Conventions

### 0.1 Task tags and tiers

As in the foundation plan (`docs/superpowers/plans/2026-11-13-world-foundation-plan.md` 0.1):

- **[AGY]**: fully specified, handed to agy through `/agy-implement` (one worktree) or `/agy-parallel`. Three stages, never merged: **haiku** runs the `agy -p` command and returns the diff stat, test output and exit status; **sonnet** implements only if agy failed or refused, and records that it did; **opus** verifies the diff against the allowlist, runs the acceptance check, and looks for weakened or deleted assertions and edits to [CLAUDE] tests. "Tier" on an [AGY] task is the tier that works if agy fails.
- **[CLAUDE]**: tests that define acceptance, licensing text, every verification, and work the plan cannot fully specify. **All art tasks are [CLAUDE]**: what a goblin should look like cannot be written as a diff in advance.
- **[RUN]**: run a given command and return its raw output. Haiku. It judges nothing. The task that follows judges.
- **[OWNER]** and **[HUMAN]**: a decision, or a look at the running game on a real GPU.
- **[CLAUDE, main session]**: a promote task. Subagents never promote a model, merge, tag, push or open pull requests; the main session runs the promotion (0.3 rule 2) with a sonnet step for the commands and an opus read of the compare report and the sheets. No commit carries an AI attribution trailer.

Model tiers used: haiku for [RUN]; sonnet for pipeline scripts, wiring and tests from a clear spec; opus for art builders, every verify and every judgement of a sheet. **Two fable stages, each with its reason:** **S2**, the pilot figure, whose rig, body route and weight rules every later figure follows (owner model rules: "the design that every later stage builds on"); and **D2**, the new dragon, the hardest shape to build by script and the figure that defines the dragon skeleton for two bosses. Both verifies stay opus. Escalate H3a to fable only if its first opus attempt is rejected at the owner step.

### 0.2 Commands

Run from the worktree root, in a shell started with an allowlisted environment: `env -i HOME="$HOME" PATH="$PATH" XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" bash`.

`CAP` stands for `scripts/capped.sh` for test, type and build commands (the memory-capped container, 3 GB, no swap, no network; amended 2026-11-24, since `systemd-run --user` no longer works after a WSL restart). Blender is not in that container: for BLEND and SHEETS, `CAP` is empty and the command runs on the host under its `timeout 600`, one Blender process at a time machine-wide.

| Name | Command | Expected |
|---|---|---|
| SUITE | `CAP env TEST_CONCURRENCY=4 npx vitest run` | exit 0 |
| ONE(file) | `CAP env TEST_CONCURRENCY=4 npx vitest run <file>` | as the task says |
| TYPES | `CAP env TEST_CONCURRENCY=4 npx tsc --noEmit` | exit 0, no output |
| BUILD | `CAP env TEST_CONCURRENCY=4 npm run build` | exit 0 |
| BLEND(mode) | `CAP timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs <mode> --out scratch/models-build` | exit 0; files only under `scratch/models-build/`. **Decided by the owner 2026-11-15 (answer "C"):** the project builds with the installed Blender 5.0.1; the downloaded 5.2.4 binary was deleted. A 5.0.1 build orders nodes and buffers differently from the shipped 5.2 files, so whole-file bytes and per-figure Brotli sizes drift; compares judge structure (Contract) and Budget, and per-figure Brotli ceilings carry 2% headroom (`scripts/models-manifest.mjs`). A rebuilt file is never byte-identical to a shipped one, and that is accepted. |
| COMPARE(name) | `node scripts/models-compare.mjs scratch/models-build/<name>.glb public/models/<name>.glb` | exit 0 = Contract (built file against `tests/fixtures/model-contract/pending/<name>.json` if it exists, else `tests/fixtures/model-contract/<name>.json`) and Budget pass; Drift (built against shipped) is reported, never fails; the report is printed and written to `scratch/models-build/<name>.report.md` |
| CAPTURE(name) | In a throw-away worktree of the task's head: copy `scratch/models-build/<name>.glb` over `public/models/<name>.glb` and any pending manifest over its live one, take the slice's in-engine poses as V4 does, delete the worktree. Every "in a throw-away worktree" test run in this plan is set up the same way | JPEGs under the task's sheet directory; nothing promoted |
| SHEETS(glb, dir) | `CAP timeout 600 /usr/bin/blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python scripts/blender/review_render.py -- <glb> <dir>` | exit 0; JPEG sheets in `<dir>` |
| UNTOUCHED | `git status --short public/models blender` | prints nothing |

**Standard gate (SG)**: SUITE, TYPES and BUILD pass. Every task ends with SG unless it says otherwise. **Blender gate (BG)**: the task's BLEND and COMPARE pass and UNTOUCHED prints nothing. A wrapper kill for memory or time is a defect to fix. Never raise the cap or the timeout.

Machine rules: one Blender process at a time, machine-wide. One BUILD at a time. At most 3 agents at once.

### 0.3 Rules that apply to every task

1. **Allowlist.** A task touches only the files listed for it.
2. **Builds never write shipped files.** Only `scripts/models-promote.mjs`, run by the main session in a task whose title starts with "Promote", changes anything under `public/models/` or `blender/*.blend`. Every other task ends with UNTOUCHED. A promote task changes exactly the files it names.
3. **Existing tests are frozen.** No edit to any file that exists under `tests/` or `src/__tests__/` when the stage starts. The **three** declared replacements, all in `src/__tests__/blender-hero.test.ts`, are made in task H5 and nowhere else (design 8.3): lines 39-42 (exactly ten clip names), lines 56-57 (local heights of `rig.torso` and `rig.headGroup`) and lines 58-59 (shoulder x at ±0.28; only if decision N-5 moves the hero's joints to the author's, as recommended). Every other assertion of that file must pass as written against every built hero. New tests go in new files under `tests/`.
4. **Test-first pairs.** A [CLAUDE] test task may leave SUITE, TYPES and BUILD red only in its own new files and only because the paired task's export or file does not exist yet.
5. **Contracts change only with the manifest.** A task that adds a node, pivot, bone, clip or `extras` key edits its file's manifest in the same commit and says so. Because `tests/model-contract.test.ts` checks the **shipped** files against `tests/fixtures/model-contract/<file>.json` on every run, a task that changes a contract before its file is promoted writes the change to `tests/fixtures/model-contract/pending/<file>.json` (a full copy with the change); COMPARE checks the built file against the pending manifest when one exists, and the promote task moves it over the live one in the same commit as the GLB. SUITE therefore stays green between an art task and its promotion. "Manifest" in a task's file list means the pending one until that promotion. No task removes or renames a manifest entry, except: slice 3 removing the guard file; a task that replaces a figure by its skinned build, which replaces that figure's manifest entry whole (pivots become bones of the same names) and says so; and H3a, which declares the hero's hierarchy and head-joint change (design 8.1).
6. **Evidence, not opinion.** An agent reports numbers and paths. "Looks better" is said only by the owner. Every art task ends with before and after sheets committed.
7. **No new runtime dependency. No new dev dependency** either: the tools are node built-ins and Blender's own Python (numpy included).
8. **Line numbers go stale.** Find symbols by name.
9. **No rule, name or save change** (design 12). The opus verify rejects any diff under `src/state/`, and any diff under `src/data/` other than the motion table (M1b), the optional `kit` and `body` look fields on `MonsterDef` (B1) and their values on Stage 4's three rows (D5, K3). No `model` value changes (critique C4).
10. **Commit format**: `<kind>(models-<slice>): <what>`, kinds `feat`, `fix`, `test`, `tool`, `asset`, `docs`. Promotions are `asset(models-<slice>): promote <file> <8-hex hash>`. Review sheets are `docs(models-<slice>): before/after sheets`.

### 0.4 Branches and clusters

- Slice 0, slice 0b and the pilot (slice 1) run serially on `feat/models-pass`: the pilot adds the engine's skinned path (`skinned.ts`, `materials.ts`, `dispose.ts`, `blenderMonsters.ts`), which everything after it uses.
- After OM-P, two clusters touch different build scripts, engine files and manifest files, and may run in separate worktrees `../osrs-like-wt/mp-<cluster>` on local branches `mp/<cluster>`, never pushed: **hero** (slices 2 and 3: `build_hero.py`, `build_gear.py`, `blenderHero.ts`, `playerMesh.ts`, `worldBuild.ts`, `actions.ts`, `model-contract/hero.json`, `gear.json`) and **monsters** (slices 4 to 7: `build_monsters.py`, `monsterMeshes.ts`, `blenderMonsters.ts`, `loop.ts`, `src/data/monsterPoses.ts`, `model-contract/monsters.json`). The monster cluster's first task (M1) needs the promoted hero (the biped clip library), so in practice the clusters overlap only from slice 4 on. They merge one at a time, each promotion rebuilt on the merged head. Inside the monster cluster every task writes `monsters.glb` and runs **serially**.
- Slice 8 comes last.

### 0.5 Owner and human steps

| Step | What the owner decides or does | Blocks |
|---|---|---|
| OM-0 | Answer the six new decisions of design 13.2: **N-1** (the pilot figure; recommended: the goblin raider), **N-2** (move gear bands and bending gear to a follow-up stage; recommended: yes), **N-3** (the 8-bit attribute step; recommended: yes), **N-4** (one or up to three draw calls per monster; recommended: decide on the pilot), **N-5** (the hero's bones at its author's joints, in its own pose; recommended: yes), **N-6** (a `Hurt` clip; recommended: not in this stage). Overturn any lead's call of design 13.3. The ten decisions of design 13.1 are already made. | Everything |
| OM-1 | Look at the baseline sheets (task V3) and the in-engine "before" captures (V4). Confirm or change the art direction (CALL-M1, M12). | Slices 0b to 8 |
| OM-S0b | Play at the goblin camp before and after the merge-only promotion; read the draw-call counter and the frame rate. | Nothing; it is evidence for 6.4 |
| **OM-P** | **The pilot.** Play beside the skinned goblin on a real GPU: walk round it, fight it, turn the outline on, watch it at the screen edge, at noon and at dusk. Choose the body route (a or b) and answer N-4. **Accept the approach, or stop it here.** | Slices 2 to 8 |
| OM-S2 to OM-S7 | After each slice: look at the after sheets and at the game on a real GPU. Accept, or name what is wrong. | The next promotion of the same file; the slice's merge |
| OM-F | Accept the stage after X3. | The pull request |

If N-1 is answered "the hero" or "the dragon", S2 builds that figure instead and S1b's engine task covers that figure's loader; the order of slices 2 and 4 does not change. If N-2 is "keep gear in this stage", the gear tasks of the earlier draft (band table, gear to budget, band shapes, band lookup; plan history at `7b2e701`) are re-added after G6, re-checked against the skinned hero. If N-3 is "no", Q1 is dropped and every ceiling reads the "as exported" column of design 9. If N-5 is "keep `LEAN_RIG`'s pivots", H3a builds the rig at `LEAN_RIG` with automatic weights against it instead of the author's (the author's weights shear there, design 6.1.4), the third replacement of rule 0.3.3 is not made, and the mount offsets do not move. If N-6 is "no" (recommended), every `Hurt` item below is skipped: the clip in H4, D2b and M3b, its rows in M1b, its cases in H5 and M1, and its wiring in H5b. If OM-P rejects the approach, the stage stops: M0p's merged monsters and slice 0's pipeline stay, S4 is not run, and the design is redrawn.

### 0.6 Goals and proofs

| Goal | Proof |
|---|---|
| GM1 A build cannot change a shipped file | `tests/model-pipeline.test.ts` (P1); UNTOUCHED after P5's full rebuild |
| GM2 Every engine contract is written down and checked | `tests/model-contract.test.ts` green on every run (P4) |
| GM3 Every figure can be looked at, before and after | Sheets committed per slice (V3, each slice's last task) |
| GM3b Every figure is a skinned mesh on one of three skeletons | Manifest skin rules in `tests/model-contract.test.ts`; after X0 no `Monster_` node and no hero mesh is rigid except the hair and eyes on the head bone |
| GM4 The hero bends and moves with weight | `tests/hero-model.test.ts` (H1); worst-pose and motion strips (H3a, H4); owner step OM-S2 |
| GM4b The dragon, Ashmantle and the demon move | `tests/monster-motion.test.ts` (M1): every bone a motion row names carries weight; owner step OM-S4 |
| GM4c One clip library per skeleton is really shared | `tests/monster-motion.test.ts`: a goblin plays the hero file's `Walk` and `Slash` and keeps its own bone lengths; Ashmantle plays the dragon's clips |
| GM5 Gear still fits and hides what it hid | `tests/gear-mount.test.ts` (H1): every mounted piece within 0.01 of a snapshot of today's hero |
| GM6 No two species share a silhouette | Roster silhouette sheet at 85 px (M4a, K4, M4c) |
| GM7 Monsters cost far fewer draw calls | Manifest mesh budgets (design 9.1: at most 4 skinned meshes per monster); goblin-camp draw calls captured at M0p, S3 and X3 |
| GM8 The download shrinks | Brotli quality 3 total at most 3,180,000 as exported, or 2,600,000 with N-3, in `model-contract.test.ts` (X2); `curl` of the preview deployment (X3) |
| GM9 Nothing about rules, names or saves changes | Rule 0.3.9 in every verify; SUITE untouched |
| GM10 Licences are complete | `tests/credits.test.ts` plus `tests/model-licences.test.ts` (P4) |

---

## R. Premise re-check

### R0 Re-check against merged Stages 4 and 5 [CLAUDE]
- **Tier**: opus.
- **Depends**: OM-0; Stages 4 and 5 merged to `main`; `feat/models-pass` rebased on it by the main session.
- **Files**: the two models-pass documents only.
- **Change**: confirm, citing file and line, or amend the design and this plan where reality differs: (1) `MonsterDef` has `model`, `tint`, `modelScale`, and the node lookup, pose and albedo read the model key; (2) `facetMaterial` still accepts extra parameters and what it does with `vertexColors`; (3) whether Stage 5's run-time merge touches figures or gear; (4) the debug pose hooks in `photo.ts` and how a capture is taken; (5) what Stage 4 did to `blender-hero.test.ts` line 136 and what `tests/new-monsters.test.ts` asserts about model keys (the critique's C4 expects "ten distinct model keys" and "the boss uses the dragon's model key"; the `kit` route must leave both green); (6) the five GLBs still hash as in design 3 (if not, re-measure section 4); (7) the dragon's and the demon's pivots are still empty (critique C1) and Stage 4 did not cut them; (8) every assertion in `tests/textures.test.ts` and `tests/dispose.test.ts` that touches a figure material or outline, as they stand after Stage 5; (9) every file path in this plan still exists, and every name and offset contract of design 8.1 (`playerMesh.ts`) is where the design says; **for skinning (design 6.1.3):** (10) the vertex shader `facetMaterial` produces after Stage 5: whether any custom normal varying is still written before `skinnormal_vertex` (today's is, and gives bind-pose bands on a bent limb, design 3.5 S7); (11) how Stage 4 applies the hero's torso lean, knock-back and hit stop while the mixer runs, and where a monster's flinch and wind-up pose are written, so the "after `mixer.update`" rule has a named place; (12) how long a monster's dying state lasts and what is drawn during it; (13) every use of `rig.chest`, `rig.belt`, `rig.neck`, `rig.head` and `rig.hairCap` outside `blenderHero.ts`; (14) whether Stage 5's `mergeByMaterial` or its leak test touches figures; (15) the lines of `src/__tests__/blender-hero.test.ts` named in design 8.3 are still at those numbers after Stage 4's edit of the same file; (16) the file where Stage 4 handles a heavy hit taken (H5b edits it) and whether it is also in the monster cluster's allowlist (`loop.ts`); if so, H5b and M1b take it in turn, never in parallel worktrees; (17) whether Stage 4 or 5 changed `addCartoonOutline` callers so that a shell is ever added mid-pose (the skinned shell must be bound with the mesh's bind matrix, design 3.5 S17).
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
  - compare (Contract is built against manifest, Drift is built against shipped): `a file equal to its manifest passes`; `a missing node fails Contract`; `a pivot 0.001 from its manifest position fails Contract`; `a pivot moved in both the file and its manifest passes Contract and shows as Drift`; `a renamed material fails Contract`; `a missing clip fails Contract`; `a merged mesh that swallowed a toggled name (TorsoCoat, Hair, _04_) fails Contract`; `COLOR_0 on some meshes of a file but not all fails Contract`; skin cases on a tiny skinned fixture: `a missing bone fails Contract`; `a bone whose rest rotation is not identity fails Contract`; `a vertex whose weights sum to 0.9 fails Contract`; `a joint index outside the skin fails Contract`; `a shared clip with a position track on a bone other than Hips fails Contract`; `a skinned root node with a translation, rotation or scale fails Contract`; `a limb more than 20 degrees from the skeleton's reference pose fails Contract`; `one more triangle than the budget fails Budget`; `a pending manifest, when present, is the one compared against, and promote moves it over the live one`; `a different generator string is Drift only`; `a truncated file is refused before any check`;
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
- **Change**: the manifest holds, per file: every contract node of design 8.1 with parent, translation and scale; pivot names per figure; material names; mesh name classes; **the toggled mesh names of design 8.1** (`Hair*`, `TorsoCoat`, `InnerCollar` and the coat prefixes; gear `_NN_` ordinals); **the centres of the hero's `Hand_L`, `Hand_R`, `Boot_L`, `Boot_R` and `Head` meshes in their pivot's space** (mount offsets of `playerMesh.ts`, tolerance 0.01); `extras` keys; whether `COLOR_0` is present (all or none); clip names and which pivots each must move; **for a skinned figure** (none exists yet; the schema and its checks are written now and exercised by P1's fixture): the skeleton it stands on, its bone list with parents and rest translations, the identity-rotation rule, the identity transform of every skinned root node (design 6.1.1 rule 2b), the weight rules of design 7.2, which clips are shared and each attack clip's anticipation time; per-figure budgets (triangles, meshes, materials, Brotli quality 3 bytes of the figure's buffers: **today's measured values** as the first ceiling, lowered by each slice); raw and Brotli quality 3 ceilings per file, and the total in `totals.json` (today's values plus 1%). Tests: shipped files satisfy the manifest; no GLB JSON chunk contains `/home/`, `/Users/`, `C:\\` or `\\Users\\`; every entry under `blender/examples/` (directory or zip) is named in `CREDITS.md`, every directory holds a licence file, and every zip's bytes include a member name containing `LICENSE` (central-directory names are stored uncompressed; `Buffer.includes` is enough); each loader's `?v=` key (where one exists) is noted, to be tied to the hash from the first promotion on.
- **Contract keys P3's compare already reads, beyond the P1 schema** (all optional, each checked when present): `meshClasses` (regex strings; every mesh name must match one), `extras` (`{ node: [keys] }`), `centres` (`{ mesh node: [x,y,z] }`, centre of the mesh bounds in the parent's space, within 0.01, unrotated nodes only), `skin.maxLimbDegrees` (required when `skin.limbs` is present), and `figures` (`{ <figure root node>: { triangles, meshes, materials, rawBytes, brotliBytes } }`, summed over the mesh nodes under that root; bytes are the buffer views its meshes and skin read, each once; a missing root fails Budget). Compare refuses (exit 3) any manifest key, `skin` key, clip key or budget metric it does not read, so P4 extends compare before a manifest carries a new key. Compare always fails a primitive carrying `JOINTS_1` or `WEIGHTS_1`. **Not yet checked: each attack clip's anticipation time.** P4 adds that check to `scripts/models-compare.mjs` (with its test) before any real skinned manifest lists an attack clip.
- **Accept**: both tests pass on today's files; SG.
- **Must not change**: `src/`, the GLBs.

### P5 Prove the pipeline: full rebuild into scratch [RUN], then [CLAUDE]
- **Tier**: haiku runs; opus judges.
- **Depends**: P2, P3, P4.
- **Files**: `docs/superpowers/baseline/models/p5-rebuild.md` (new).
- **Change**: [RUN] `sha256sum public/models/*.glb blender/*.blend`; BLEND(all); BLEND(guard); COMPARE for the five names; the same `sha256sum`; UNTOUCHED. [CLAUDE] writes the record: Blender version, generator strings, times, each report's summary, both hash lists.
- **Accept**: five builds exit 0; five compares exit 0 with zero Contract differences and zero Drift apart from the generator string and the three guard meshes design 3.2 found (floats within 0.00022); the two hash lists are equal; UNTOUCHED. A second BLEND(hero) gives a byte-identical binary chunk (the critique's E2 and E7 found builds and bakes deterministic).
- **Amended 2026-11-15** (main session, after the owner chose Blender 5.0.1): Accept is: five builds exit 0 on 5.0.1; five compares exit 0 on Contract and Budget, with per-figure Brotli ceilings at the shipped value plus 2%; whole-file and buffer-order Drift is reported and accepted; the three guard meshes may drift by up to 1.2e-7 in POSITION and 0.00023 in NORMAL (the measured drift is 0.00022215; the bound is set with a little room, and it applies only to those three meshes). A second build of the same file is byte-identical to the first (determinism on one machine).
- **Must not change**: everything shipped. **Nothing is promoted.**

### V1 Review renderer [AGY]
- **Tier**: sonnet.
- **Depends**: P2.
- **Files**: `scripts/blender/review_render.py` (new), `scripts/blender/review_scales.json` (new: figure name to in-game scale, from design 4.2).
- **Change**: arguments `<glb> <out dir> [--only a,b] [--against <other.glb>] [--clips] [--engine-palette]`. Cycles, CPU, 24 samples, one sun and one fill, grey world. Cameras face the figure's front (glTF +Z; the critique's strips came out from the back). For each root with meshes, the five sheets of design 7.3: turnaround (three views, 512 px), silhouette (same views, emission-black override on white), play distance (1080-line frame, 50 degree vertical field of view, distances 5.4, 8.5 and 26 with pitch 0.18, 0.24, 0.24, cropped to the figure, in-game scale applied, pixel height drawn in the corner), motion with `--clips` (per clip: **set every object's `animation_data.action` to `None`**, then mute every NLA track but that clip's, six evenly spaced frames; print each pivot's rotation range in the clip; without clearing the action the importer's `Idle` overrides every clip, critique C2; for a skinned figure the same on its armature), a **worst-pose sheet** for any figure with an armature (`--worst`: deep crouch, one arm overhead, full torso twist, head turned, tail or wings at their limits where those bones exist), and side-by-side with `--against`. `--engine-palette` colours the hero by `extras.part` with the colours of `blenderHero.ts` 182-197. One roster silhouette sheet with every figure at its 26-distance size. Skinned figures all sit at the file's origin (design 6.1.1 rule 2b), so the renderer lays figures out itself (one per tile, or `--only`), never relying on their place in the file. Tiles are assembled with numpy and saved as JPEG quality 88 through `bpy.data.images`. Prints one line per sheet with path, seconds and pixel height.
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

### H6 Vertex-colour test [CLAUDE] (CALL-M11 decided 2026-11-14)
- **Tier**: sonnet.
- **Depends**: R0.
- **Files**: `tests/model-vertex-colour.test.ts` (new), `tests/fixtures/models/` (a tiny GLB with `COLOR_0` on every mesh, written by the test's helper).
- **Change**: `a hero whose file carries COLOR_0 gets vertexColors true on every role material, and rig.tunicMat is the material on the coat mesh` (recolouring by `playerMesh.ts` still reaches it); `a monster and a gear piece whose meshes carry a color attribute get materials with vertexColors true`; `today's GLBs produce no material with vertexColors`.
- **Accept**: red until H6b.
- **Must not change**: `src/`.

### H6b Vertex colour in the engine [AGY]
- **Tier**: sonnet.
- **Depends**: H6.
- **Files**: `src/engine/blenderHero.ts`, `src/engine/blenderMonsters.ts`, `src/engine/blenderGear.ts`.
- **Change**: hero: if any mesh of the cloned scene has a `color` attribute, create the role materials with `vertexColors: true` (one flag at creation; no second instance). Monsters and gear: pass `vertexColors: true` to the `facetMaterial` and `albedoMaterial` calls for a mesh whose geometry has a `color` attribute (each mesh already gets its own material, or one per family per gear clone; the manifest guarantees all or none per file).
- **Accept**: `ONE(tests/model-vertex-colour.test.ts)` passes; SG.
- **Must not change**: material choice by name; outline shells; `materials.ts`; `textures.ts`.

### F1 Figure kit, part 1: merge, paint, export [AGY]
- **Tier**: sonnet.
- **Depends**: P2.
- **Files**: `scripts/blender/figkit.py` (new), `scripts/blender/figkit_selftest.py` (new, asserts on a generated two-part figure and exits non-zero on failure).
- **Change**: `merge_parts(root, keep=TOGGLED)`: joins meshes sharing parent, material, `noOutline` and name class (`eye`, `glow`, `gem`, `orb`, `string`, other), keeps a name in the class, keeps `extras`; **never merges a mesh whose name matches `TOGGLED`** (`^Hair`, `^CrownSpike_`, `^BackSpike_`, `^Sideburn_`, `^TorsoCoat$`, `^OuterCoat_`, `^CoatTrim_`, `^CoatTail_`, `^CoatTailTrim_`, `^InnerCollar$`, `_leg[LR]_04_`) and keeps the `_NN_` ordinals of those leg meshes unchanged; other gear `_04_` meshes merge freely. `bake_paint(root, ao=0.35, gradient=0.15, warm_cool=0.05)`: Cycles CPU vertex bake of ambient occlusion into a colour attribute named `Col` on the **`POINT` domain**, multiplied by a height gradient and a front-to-back tint; with `--fast-paint` a crease-angle term replaces the ray-traced one. `export_glb(path)` with `export_vertex_color='ACTIVE'`, `export_texcoords=False` (no figure reads GLB UVs, design K2), `export_extras=True`, `export_yup=True`.
- **Accept**: the self-test exits 0 inside 60 s under CAP; the two-part figure exports with `COLOR_0`, no `TEXCOORD_0` and half the meshes; a mesh named `TorsoCoat` survives a merge alone; the hero built with `export_texcoords=False` passes `ONE(src/__tests__/blender-hero.test.ts)` in a throw-away worktree (proves the engine needs no GLB UVs); SG; UNTOUCHED.
- **Must not change**: the four build scripts.

### OM-1 [OWNER]
Look at V3 and V4 and, if possible, the same places in the game on the owner's machine. Confirm the art direction or change it. The design's section 5 is amended before slice 1 if anything changes.

---

## Slice 0b: merge-only pass over the monsters

Kept from the critique (M10) as the cheapest test of whether draw calls hold the frame rate (design 6.4). No shape, no engine change.

### M0 Merge every monster builder's output [AGY]
- **Tier**: sonnet.
- **Depends**: F1, OM-1.
- **Files**: `scripts/blender/build_monsters.py` (one `figkit.merge_parts` call per `Monster_*` root before export), `tests/monster-merge.test.ts` (new, written and committed first by a [CLAUDE] sonnet step: triangles per engine material family per figure equal a fixture computed from today's file by the rule of `blenderMonsters.ts` 103-136; every pivot keeps its meshes' families; meshes per figure at most half today's), `tests/fixtures/monster-families.json` (new), `tests/fixtures/model-contract/monsters.json` (mesh ceilings).
- **Change**: merge only; no geometry, name, pivot or colour change.
- **Accept**: BG for monsters; `monster-merge.test.ts` green against the built file (throw-away worktree); mesh count reported (399 today; the goblin alone went 59 to 29 in design 3.3); CAPTURE(monsters) of the goblin camp beside V4's before.
- **Must not change**: everything but mesh grouping.

### M0p Promote monsters, merge only [CLAUDE, main session] + OM-S0b
- **Tier**: sonnet runs the commands; opus reads the compare report.
- **Depends**: M0.
- **Files**: `public/models/monsters.glb`, `blender/monsters.blend`, `src/engine/blenderMonsters.ts` (the `?v=` key only), `tests/fixtures/model-contract/monsters.json`, `tests/model-cache-key.test.ts` (new: key equals hash prefix for every loader that has one), `docs/superpowers/baseline/models/s0b/`.
- **Change**: BLEND(monsters), COMPARE, promote, set the key. Captures of the start pose and the goblin camp with the perf HUD's draw calls and frame time, before and after.
- **Accept**: SG; the two captures and their numbers committed. Then **OM-S0b**: the owner reads the same two numbers on the real machine. The result is written into the design's review log, whichever way it goes.
- **Must not change**: any other shipped file.

---

## Slice 1: the pilot (one skinned figure, in the game, end to end)

Nothing after this slice starts until **OM-P** accepts the approach.

### S0 Skinned-path tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: R0, P4.
- **Files**: `tests/skinned-figure.test.ts` (new), `tests/fixtures/models/skinned-pair.glb` (new, under 8 kB, written by the test's own helper: one skinned figure of two bones named `probe_Torso` and `probe_LeftArmPivot` and one rigid figure, in one file).
- **Change**: the cases of design 8.3: `two instances cloned from one template pose independently and the template stays at rest`; `bone names lose the node key's prefix on the clone`; `every pivot field the upgrade fills is a Bone`; `the outline shell of a skinned mesh is a SkinnedMesh on the same skeleton and uses the skinned outline material`; `a plain mesh still gets today's shell and today's outline material`; `the skinned outline material is shared and never disposed`; `each skinned mesh has a fixed boundingSphere of at least 1.5 times its rest radius, unchanged after a pose`; `disposeObject3D calls dispose on each skeleton once`; `the rigid figure in the same file takes the rigid path and is unchanged`; `writing rotation.x on a bone moves a vertex weighted to it` (read with `getVertexPosition`); `a skinned Monster_ node with a non-identity transform is refused with a warning and takes no path` (design 6.1.1 rule 2b; a fixture placed at (6, 0, 2) is drawn 6.32 off otherwise, S15); `adding an outline to a posed instance leaves a second instance's vertices unmoved and the template's boneInverses unchanged` (S17); `a skinned shell has its own boundingSphere, at least its mesh's plus the outline margin`; `a clip whose tracks carry the node key's prefix, stripped once by stripClipPrefix, drives the stripped bones`.
- **Accept**: red until S1b.
- **Must not change**: `src/`, any existing test.

### S1 Figure kit, part 2: rigs, bodies, weights, clips [AGY]
- **Tier**: sonnet.
- **Depends**: F1.
- **Files**: `scripts/blender/figkit.py`, `scripts/blender/figkit_selftest.py`, `scripts/blender/rigs.py` (new: the three skeleton tables of design 6.1.2 as data: bone, parent, optional flag, and each skeleton's **reference pose** as a unit direction from each bone to its child).
- **Change**: `make_rig(name, table, joints, prefix)`: an armature object **at the origin with identity transform** (design 6.1.1 rule 2b) whose every bone points straight up with roll 0, heads at the given joint positions, named `<prefix>_<Bone>` when a prefix is given; it refuses joints whose limb directions are more than 20 degrees from the skeleton's reference pose (design 6.1.1 rule 3; the biped's reference is the hero source's A-pose of design 3.5 S14), unless the table row is flagged `code_posed` (the chicken). No re-pose step: bodies are modelled, weighted and bound in the reference pose. `organic_body(graph, radii, voxel, triangles)`: stick graph, skin modifier, voxel remesh, smooth, decimate, `validate()`. `auto_weights(body, rig, spread_pose)`: builds a limb-aligned twin of the rig with the same names, runs Blender's automatic weights against it, re-binds the body to the world-aligned rig, limits to 4 influences and normalises; if any vertex is unweighted it calls `segment_weights` (distance to each limb segment over the limb's radius, blended across the two nearest) and prints that it did. `hard_weights(part, bone)`: weight 1 on one bone. `fold_weights(mesh, mapping)`: sums a source's vertex groups onto the rig's bones and normalises. `merge_by_family(root, keep=TOGGLED)`: one skinned mesh per engine material family and outline flag (the family rule of `blenderMonsters.ts` 103-136, written once in `figkit.py` and mirrored by `tests/monster-merge.test.ts`'s fixture rule). `make_clip(rig, name, frames, pose_table)`: samples a pose table per frame onto pose bones as **quaternions** (`rotation_mode = 'QUATERNION'`), where the table's rotations are three-space Euler triples read in three's `YZX` order (the order today's `t2b_euler` plus Blender `XYZ` produces on empties, design 3.5 S16; Blender `XYZ` on a bone is 0.34 rad off), one NLA track per clip, clears the active action. `export_glb` gains `export_skins=True`, `export_animation_mode='NLA_TRACKS'`, `export_optimize_animation_keep_anim_armature=False` (rotation-only clips, design 3.5 S3).
- **Accept**: the self-test builds a two-limb skinned figure with one clip and asserts, on the exported file read back in Blender: the armature node has no transform; a pose table entry (0.3, 0.5, 0.7) on a bone exports the same quaternion as an empty keyed by today's `build_action` (within 1e-5); every joint has identity rotation; no unweighted vertex; at most 4 influences; the clip has rotation channels only; a part given `hard_weights` has weight 1 on its bone; exits 0 inside 60 s under CAP. SG; UNTOUCHED.
- **Must not change**: the four build scripts; `merge_parts` and `bake_paint`.

### S1b The skinned path in the engine [AGY]
- **Tier**: sonnet; opus verify reads the shader text against design 6.1.3 and R0 item 10.
- **Depends**: S0.
- **Files**: `src/engine/skinned.ts` (new, under 120 lines: `hasSkin(node)`, `cloneFigure(node)` using `SkeletonUtils.clone` from `three/examples/jsm/utils/SkeletonUtils.js` (refuses a skinned root whose transform is not identity), `stripBonePrefix(root, key)` where `key` is the key of the `Monster_<key>` node that was cloned (the `body` key when a def has one), `stripClipPrefix(clips, key)` (once per library, cached), `fixCullSpheres(template, factor = 1.5)` run once on the template so clones copy the sphere; the per-instance `geometry.clone()` stays), `src/engine/materials.ts` (`addCartoonOutline`: for a `SkinnedMesh`, a `SkinnedMesh` shell bound with `shell.bind(mesh.skeleton, mesh.bindMatrix)` (never without the bind matrix, design 3.5 S17), given `boundingSphere` = the mesh's plus the outline margin (culling reads the object's sphere, not the geometry's), and a skinned variant of the outline material, cached under its own key, whose vertex shader includes `skinning_pars_vertex`, `beginnormal_vertex`, `skinbase_vertex`, `skinnormal_vertex`, `begin_vertex`, `skinning_vertex` and uses `transformed` and `objectNormal`; `facetMaterial`: only if R0 item 10 found a normal written before the skin, move it after `skinnormal_vertex`), `src/engine/dispose.ts` (dispose each `SkinnedMesh`'s skeleton once), `src/engine/blenderMonsters.ts` (`upgradeMonsterRigWithGltf`: if `hasSkin(template)`, `cloneFigure`, `stripBonePrefix`, the same material rules, `fixCullSpheres`; otherwise today's path, untouched).
- **Change**: as design 6.1.3. No list of skinned figures anywhere: the file decides.
- **Accept**: `ONE(tests/skinned-figure.test.ts)` passes; `ONE(tests/textures.test.ts)`, `ONE(tests/dispose.test.ts)`, `ONE(src/__tests__/lean-rig.test.ts)` and `ONE(src/__tests__/blender-hero.test.ts)` pass untouched; SG (the JS chunk grows by the clone utility; BUILD reports it against Stage 5's cap).
- **Must not change**: the rigid path; the plain outline material and its uniforms; material choice by name; `poseMonsterLimbs`.

### S2 The pilot figure: goblin raider, rebuilt and skinned [CLAUDE]
- **Tier**: **fable** (the rig, body route and weight rules eight more figures follow); opus verifies.
- **Depends**: S1, M0p.
- **Files**: `scripts/blender/build_monsters.py` (the goblin raider's builder only), `tests/fixtures/model-contract/monsters.json` (the goblin's entry replaced whole: biped skeleton, bones `goblin_<Bone>`, skinned-mesh and wire ceilings).
- **Change**: to design section 5 and 4.6: hunched line of action, big ears and jaw, one tapered torso, the spear and shield outside the outline and hard-weighted to `WeaponPivot` and `OffhandPivot`, olive at 30 to 45% value with a bone and rust accent, optional `Jaw`. Modelled, weighted and bound in one pose, with every bone at identity, within 20 degrees per limb of the biped reference, which is the hero's A-pose (design 6.1.1 rule 3; no re-pose): the hunch and the arms held a little out are the goblin's stance, and they will carry through the shared clips at M1b. 5,000 triangles. **Built two ways** (design 6.2): (a) `organic_body` from a stick graph; (b) today's primitives fused by a voxel remesh; the same head, gear, palette and rig on both. **Each built in two material variants** for decision N-4: up to three families, and one material with the colours in the paint layer. `bake_paint` on all.
- **Accept**: BG for each build; `tests/monster-merge.test.ts`'s goblin fixture replaced by this task (declared: the figure is new); turnaround, silhouette, play-distance and **worst-pose** sheets of both routes `--against` shipped under `docs/superpowers/baseline/models/s1/`; **measured Brotli bytes of the figure for each build, and the per-figure wire ceilings of design 9.1 reset from them**; a short written pattern (what was done, in order, with the kit calls and the weight rules that were needed) appended to `docs/superpowers/baseline/models/README.md`.
- **Must not change**: `Monster_goblin`; the names `goblin_HeadGroup`, `goblin_LeftArmPivot`, `goblin_RightArmPivot`, `goblin_LeftLegPivot`, `goblin_RightLegPivot` (their positions follow the new body: no engine code reads a monster pivot's position, design 6.1.1 rule 1); material name substrings; in-game height within 5%; every other builder (their Drift is zero apart from their own node, which stays where it is while rigid; the goblin's skinned node sits at the origin, rule 2b).

### S3 The pilot in the game [CLAUDE, main session]
- **Tier**: sonnet runs; opus reads.
- **Depends**: S1b, S2.
- **Files**: `docs/superpowers/baseline/models/s1/ingame/` (new), `docs/superpowers/baseline/models/s1/README.md`.
- **Change**: CAPTURE(monsters) for each of the four builds at the goblin camp, with the skinned raider beside the still-rigid archers: standing, walking, mid-attack, mid-flinch and holding Stage 4's wind-up pose (all driven by today's `poseMonsterLimbs` on bones); the outline turned on; noon and dusk (a bent arm in light and in shadow, the check of design 6.1.3's banded-light row); the figure at the screen edge and half off it (culling); its shadow on the ground; after 30 kills and respawns, `renderer.info.memory` beside the value before (the leak check). The perf HUD's draw calls and frame time at the camp, beside M0p's.
- **Accept**: the captures and numbers committed, set out against the six go/no-go criteria of design 10 (P-a to P-f), each marked met or not with its evidence; for P-d, the hero's `Walk` and `Slash` are first built in scratch through S1's `make_clip` with design 6.1.5's conversion (rotation-only plus the legs' `Hips` keys; the shipped clips cannot be used, because they are sibling-space and carry position tracks that would overwrite the goblin's joint offsets, design 3.5 S4), then played on the skinned goblin in the same throw-away worktree by a twenty-line `AnimationMixer` (tracks matched by bone name; nothing committed under `src/`); for P-e, close crops of head and hands of both routes beside today's goblin. Any correctness fault (P-b) is fixed by a follow-up task before OM-P.
- **Must not change**: anything shipped.

### OM-P [OWNER]
Play beside the pilot on a real GPU. Choose route (a) or (b); answer N-4 (one material or up to three). Decide on criteria P-a to P-f (design 10) with one of three outcomes: **accept**; **accept the engine path but not scripted bodies** (figures then come from CC0 or CC-BY rigged bases folded onto the shared rigs, one sign-off each, or the remaining monsters stay rigid and merged and X0 is dropped); or **stop**. This sets the pattern for every figure; a change here is cheap, later it is not.

### S4 Promote monsters with the pilot [CLAUDE, main session]
- As M0p (same tier, files, accept and must-not-change), sheets under `s1/`. **Depends**: OM-P. From here on the shipped game has one skinned monster among rigid ones.

### Q1 Eight-bit attributes in the promote step [CLAUDE] test, then [AGY] (only if N-3)
- **Tier**: sonnet for both.
- **Depends**: S4, P3.
- **Files**: `tests/model-pack.test.ts` (new, first), `scripts/lib/glb-pack.mjs` (new, plain node, no dependency), `scripts/models-promote.mjs`.
- **Change**: test: `normals become normalised signed bytes and the file lists KHR_mesh_quantization as used and required`; `weights and colours become normalised unsigned bytes and each vertex's weights still sum to 255`; `positions, joints, indices and animation data are byte-identical`; `the bare GLTFLoader parses the packed file`; `every posed vertex of the packed fixture is within 0.001 of the unpacked one`; `a file with no skin and no colour only has its normals packed`; `packing twice changes nothing`. Then the script (the method of design 3.5 S10) and its call inside promote for `hero` and `monsters` only; Contract and Budget are checked on the packed file.
- **Accept**: `ONE(tests/model-pack.test.ts)` passes; the pilot promoted again shows about 30% fewer wire bytes for the goblin; `ONE(src/__tests__/blender-hero.test.ts)` passes untouched against a packed `monsters.glb`; SG.
- **Must not change**: `gear.glb`, `world.glb` (the engine reads their positions in metres and their merge path was not measured); the build scripts.

---

## Slice 2: hero

### H1 Hero acceptance tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: OM-P.
- **Files**: `tests/hero-model.test.ts` (new), `tests/gear-mount.test.ts` (new), `tests/fixtures/hero-mounts.json` (new: for a full ten-slot loadout mounted on **today's** hero by today's `rebuildPlayerEquipmentMeshes` logic, at the **reference pose** (every pivot's rotation set to identity and its position to the builder's rest value, which removes the frame of `Idle` the shipped file carries), every mounted piece's position, rotation and scale **in the figure's space**, the centres of the hand, foot and head meshes in the figure's space, and which meshes are hidden; written by a helper in this task, before anything changes. The same reference pose is set on the skinned hero (every bone at identity), so the two compare directly although the joints move, design 6.1.4).
- **Change**: `hero-model`: rotation range per clip as the critique's E4 measured it: `every attack clip turns Torso by at least 0.3 rad` (today `Lunge` 0.24 and `Cast` 0.12 fail); `Idle turns Torso or HeadGroup by at least 0.08 rad` (today 0.03); `Walk turns Torso by at least 0.08 rad` (today 0.04); `Fish turns an arm by at least 0.3 rad` (today 0.10); `in Slash, Lunge, Chop and Mine the right arm's x rotation first moves against the strike` (`Lunge` fails today); `Walk bends each knee bone by at least 0.3 rad and Slash bends the right elbow by at least 0.3 rad` (new with skinning); `the hero is skinned on the biped skeleton with the bone list of design 6.1.2`; `Hair, TorsoCoat and InnerCollar exist as their own meshes`; `shared clips have rotation tracks only, plus Hips position`; `triangles at most 6,000, meshes at most 11`; `meshes carry COLOR_0`; and the two frozen samples restated so they fail here first: `0.2 s into Walk a leg bone's x rotation exceeds 0.01` and `0.15 s into Slash at time scale 1.2 the right arm's x rotation exceeds 0.05`. `gear-mount`: `at the reference pose every mounted piece's transform in the figure's space equals the fixture within 0.01 and 0.02 rad`; `the hand, foot and head centres in the figure's space at the reference pose are within 0.01 of the fixture`; `with the right arm bone turned 1 rad on x, the weapon turns about that bone's joint` (the mount follows the true joint); `a helm hides every Hair* mesh; body armour hides TorsoCoat and InnerCollar`; `armour recolours the role materials on the meshes that carry them`.
- **Accept**: `gear-mount` passes on today's hero; `hero-model` is red in the cases named and in every skin case; the task records the actual red list in the test file's header.
- **Must not change**: `src/`, any existing test.

### H2 One mounting function [AGY]
- **Tier**: sonnet.
- **Depends**: H1.
- **Files**: `src/engine/playerMesh.ts`, `src/engine/worldBuild.ts` (the merchants' hat).
- **Change**: the mounting part of `rebuildPlayerEquipmentMeshes` (offsets, hide loops, recolouring) moves, unchanged, into an exported `mountLoadout(rig, items)`; the player calls it; the merchant's hat is mounted through it instead of its own copy of the helm offset (`worldBuild.ts`, `createMerchantNPC`).
- **Accept**: `ONE(tests/gear-mount.test.ts)` passes; `ONE(src/__tests__/blender-hero.test.ts)` passes untouched; SG.
- **Must not change**: any offset, any hide rule, any colour.

### H3a Hero skin: author's weights on the biped rig, clips on bones [CLAUDE]
- **Tier**: opus (fable if rejected once at the owner step).
- **Depends**: H1, S1.
- **Files**: `scripts/blender/build_hero.py`, `tests/fixtures/model-contract/hero.json` (the hero's entry replaced whole and **declared**: the flat pivot layout becomes the chain `Root`, `Hips`, `Torso`, `HeadGroup` and arms, legs under `Hips`; `HeadGroup` moves from 1.86 to the source's neck joint; design 8.1).
- **Change**: keep the source's `Armature` instead of deleting it (`build_hero.py` 439-443 today removes it); `fold_weights` its 59 groups onto the 16 biped bones (the mapping of design 3.5 S13: `waist` to `Hips`, `spine1` and `spine2` to `Torso`, `neck` and `head` to `HeadGroup`, fingers to the hand, ankle and feet to the foot); scale and place as today (1.85 tall, soles at 0) and centre x (+0.011, design 3.5 S14); **bind in the source's own pose, with no re-pose** (decision N-5; that pose is the biped reference); `make_rig` at the origin with joints at the **author's** bone heads after the same transform (design 3.5 S14: shoulders ±0.178 at 1.478, hips ±0.111 at 1.007, knees 0.604, `Torso` 1.146, `Hips` 0.963, `HeadGroup` at `neck` 1.504), **not** at `LEAN_RIG`'s constants (`build_hero.py` 560-574), around which the author's weights would shear; the joint table is written into the manifest; meshes joined by engine role into at most 11 (design 6.1.4), with `Hair` and the eyes left rigid on the head bone and `TorsoCoat` and `InnerCollar` as their own skinned meshes; `extras.part` kept on each. The ten clips come from today's sample functions through `make_clip`, **converted for the chain** (design 6.1.5), as quaternions: for `HeadGroup` and the arm bones, local rotation = inverse of the torso's quaternion of that frame times today's quaternion (today's quaternion is three's `Euler(rx, ry, rz, 'YZX')` of the sample function's numbers, design 3.5 S16), **except in `SpinSlash`**, where the arm bones keep today's numbers as local rotations (the head is converted normally); elbows, knees and legs unchanged; **only the legs' position keys** (today `Walk`'s dip) become the `Hips` track; the torso's own position keys (`Idle`, `Walk`, `Lunge`, `Cast`) and the follow-the-torso keys on the head and arms are dropped. Timing unchanged. No clip is improved here.
- **Accept**: BG for hero; **a mechanical clip check written in this task** (`scripts/models-clipcheck.mjs`, plain node): for each of the ten clips at twelve evenly spaced times, the orientation in the figure's space of `Torso`, `HeadGroup`, both arm, elbow, leg and knee bones of the built file equals the same pivot's in the shipped file within 0.02 rad (`SpinSlash`'s arm bones excepted), **and each leg bone's displacement from rest in the figure's space equals the shipped leg pivot's within 0.01** (no `Hips` key moves the legs where today's did not), and the report lists the largest difference per clip; in a throw-away worktree with the built file and H5 and H5b applied, `ONE(src/__tests__/blender-hero.test.ts)` is green; the skin cases of `hero-model` are green against the built file; turnaround `--engine-palette`, **worst-pose** and motion strips of `Walk`, `Slash` and `Chop` `--against` the shipped file under `docs/superpowers/baseline/models/s2/`, with every seam between two skinned meshes shown in a bend; CAPTURE(hero) of the two hero poses, undressed and in the plate set.
- **Must not change**: every `extras.part` value and mesh name the engine reads or toggles (design 8.1); hand, foot and head centres beyond 0.01; clip names and lengths; the body's bounds beyond 3% per axis; the CC-BY source and its credit.

### H3b Hero face, hands, hair, paint [CLAUDE]
- **Tier**: opus.
- **Depends**: H3a.
- **Files**: `scripts/blender/build_hero.py`, `tests/fixtures/model-contract/hero.json`.
- **Change**: to design 5.2 to 5.4: hands 15% larger **about their own centre** (the mount offsets hold); the face given planes that read at 260 px (brow, nose, jaw; eyes kept as their own meshes); hair as three or four large locks, still named `Hair*`; `bake_paint`.
- **Accept**: BG; turnaround and silhouette sheets `--engine-palette --against` the shipped file under `s2/`; `ONE(tests/gear-mount.test.ts)` green against the built file; a turnaround of the built body wearing today's plate set showing no hand, hair or limb poking through and no floating glove or boot, at rest and in the worst pose; CAPTURE(hero).
- **Must not change**: as H3a.

### H4 Hero motion: the biped library [CLAUDE]
- **Tier**: opus.
- **Depends**: H3a.
- **Files**: `scripts/blender/build_hero.py`, `tests/fixtures/model-contract/hero.json` (clips: the two frozen samples, each attack clip's anticipation time, `Death`, and `Hurt` if N-6).
- **Change**: design 6.5, smooth only: sample functions become pose tables on a twelve-a-second grid sampled per frame; elbow and knee bends added to every clip; the clips H1 marks weak improved (`Idle`, `Walk` torso counter-rotation and a level head, `Fish`, `Lunge` wind-back and its forward thrust re-made as hip and torso pitch, since H3a dropped the torso translation, `Cast` torso lead); attack clips otherwise kept, since they already have three beats (critique C2); `Death` (1.1 s, ends lying, last pose held) and `Hurt` (0.35 s) added. Clip lengths within 10% of today's.
- **Accept**: BG; every `hero-model` motion case green against the built file, including the two frozen samples; motion strips for all twelve clips under `s2/`; the opus verify names the frame of each of the three beats in every attack strip; CAPTURE(hero) walking, striking and falling.
- **Must not change**: the ten clip names; the two frozen samples; clip lengths beyond 10%; rotation-only tracks except `Hips`.

### H5 Declared replacements and clip tests [CLAUDE]
- **Tier**: sonnet; opus verify compares the diff of the frozen file with design 8.3 word for word.
- **Depends**: H3a (so the replaced assertions can be run against a built file).
- **Files**: `src/__tests__/blender-hero.test.ts` (**the three declared replacements and nothing else**: lines 39-42 become "the ten names are all present, and the full sorted list equals the manifest's hero clips"; lines 56-57 become "the heights of `rig.torso` and `rig.headGroup` in the rig group's space equal the manifest's `Torso` and neck joint heights to two decimals"; lines 58-59 become "the x of each arm bone in the rig group's space equals the manifest's shoulder joint x to two decimals", made only under N-5's recommended answer), `tests/hero-clips.test.ts` (new).
- **Change**: `hero-clips`: `Death plays once and clamps on the last pose`; `finishRespawn returns to Idle`; `Hurt plays only when no one-shot is active`; `a running attack is never interrupted by Hurt`; `Stage 4's torso lean and knock-back offsets are still applied while a clip plays` (read from the rig after one update); `two hero instances (the player and a merchant) pose independently`.
- **Accept**: the frozen file's diff is exactly those hunks; with today's shipped hero the replaced assertions pass (the manifest still lists ten clips, the flat heights and ±0.28 until H7); `hero-clips` is red until H5b.
- **Must not change**: every other line of `blender-hero.test.ts`, including 60-61, 66 and 70.

### H5b The hero on the skinned path [AGY]
- **Tier**: sonnet.
- **Depends**: H5, H2, S1b.
- **Files**: `src/engine/blenderHero.ts` (`upgradeHumanoidRigWithGltf`: `cloneFigure` when the file has a skin; material assignment by `extras.part` and mesh name unchanged; `HeroClipName` gains `Death` and `Hurt`), `src/engine/playerMesh.ts` (`mountLoadout`: the two hide loops search `rig.group`; **every** mount offset becomes today's offset plus (today's pivot rest position minus the mount bone's rest position), with the bone rest positions read from the rig, so today's rigid hero and the skinned one both place every piece where the fixture says; design 6.1.4), `src/engine/actions.ts` (`handlePlayerDeath` plays `Death`; `finishRespawn` returns to `Idle`), the engine file where Stage 4 handles a heavy hit taken (named by R0: requests `Hurt`, dropped if a one-shot is active).
- **Change**: as design 6.1.3 and 6.1.4. The loader takes the skinned path only when the file has a skin, so this lands before the hero file is promoted.
- **Accept**: `ONE(tests/hero-clips.test.ts)`, `ONE(tests/gear-mount.test.ts)` and `ONE(src/__tests__/blender-hero.test.ts)` pass against today's file **and**, in a throw-away worktree, against the built one; SG.
- **Must not change**: Stage 4's timings in `feel.ts`; respawn timing; the death overlay; any mount offset beyond the joint-move arithmetic; any piece's rotation or scale.

### H7 Promote hero [CLAUDE, main session] + OM-S2
- **Tier**: sonnet runs the commands; opus reads the compare report and the sheets.
- **Depends**: H3b, H4, H5b, H6b.
- **Files**: `public/models/hero.glb`, `blender/hero.blend` (CALL-M10), `src/engine/blenderHero.ts` (the `?v=` key only), `tests/fixtures/model-contract/hero.json` (ceilings lowered to the built values plus 2%), `docs/superpowers/baseline/models/s2/`.
- **Change**: BLEND(hero), COMPARE, promote (packed if N-3), set the key, SHEETS `--against` the old file, in-engine captures of the two hero poses, of a merchant, and of the hero in a full plate set mid-swing.
- **Accept**: SG; `ONE(tests/hero-model.test.ts)` fully green; wire size of `hero.glb` at most 200,000 (150,000 if N-3); sheets at most 2 MB. Then **OM-S2**.
- **Must not change**: any other file under `public/models/` or `blender/`.

---

## Slice 3: gear merge and guards

Gear bands, gear to budget and bending gear moved to the follow-up stage (decision N-2).

### G2 Merge test [CLAUDE]
- **Tier**: sonnet.
- **Depends**: P4.
- **Files**: `tests/gear-merge.test.ts` (new), `tests/fixtures/gear-families.json` (new: triangles per engine material family per node, computed from today's file by the rule of `blenderGear.ts` 93-116).
- **Change**: for every `Gear_*` node of the shipped file, triangles per material family equal the fixture; meshes per node at most 4, except nodes whose fixture has more than 4 families.
- **Accept**: the family case passes today; the mesh-count case is red until G6.
- **Must not change**: `src/`.

### G2b Merge gear meshes [AGY]
- **Tier**: sonnet.
- **Depends**: G2, F1.
- **Files**: `scripts/blender/build_gear.py` (one call per root before export).
- **Change**: call `figkit.merge_parts` on every `Gear_*` root (toggled names and `_04_` ordinals kept, F1). Gear stays rigid.
- **Accept**: BG for gear; `gear-merge.test.ts` green against the built file (throw-away worktree); `ONE(src/__tests__/blender-hero.test.ts)` and `ONE(tests/gear-mount.test.ts)` green there too; mesh count reported (506 today); CAPTURE(gear) of the hero in a full plate set and in the bandos set (projected albedo tiles shift on merged parts, critique M2).
- **Must not change**: geometry, node names, materials, mount space.

### G6 Promote gear, merge only [CLAUDE, main session]
- As H7 for `gear.glb` (`src/engine/blenderGear.ts`, the `?v=` key only); wire size at most 690,000; `gear-merge.test.ts` fully green. **Depends**: G2b, H7.

### N1 Guard tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: G6.
- **Files**: `tests/guards.test.ts` (new).
- **Change**: `createCastleGuard` produces, for both guards: the same position, the same `npcList` label and dialogue text, a hitbox of the same size, `userData` keys unchanged (values read from today's code and written into the test), a rig flagged `isBlenderHero` once the hero template resolves, its own skeleton (posing one guard does not move the other or the player), and no request for `guard.glb` (the loader stub records URLs); meshes per guard at most 35.
- **Accept**: red until N2.
- **Must not change**: `src/`.

### N2 Guards from the hero and gear [AGY]
- **Tier**: sonnet.
- **Depends**: N1.
- **Files**: `src/engine/worldBuild.ts`, `public/models/guard.glb` (delete), `scripts/blender/export_guard.py` (delete), `scripts/run-blender.mjs` and `package.json` (remove the guard mode), `tests/fixtures/model-contract/guard.json` (delete) and `totals.json`, `tests/model-pipeline.test.ts` (the one `guard is a mode` case, created by this plan, removed).
- **Change**: design 10.3. `loadBlenderGuardTemplate` is deleted. The guard is built the way the merchant is, dressed through `mountLoadout` with the full helm, plate body, plate legs, kite shield and sword visuals in guard steel `0x80898f` with gold trim, and plays `Idle`. No mount offset is copied.
- **Accept**: `ONE(tests/guards.test.ts)` passes; `test ! -e public/models/guard.glb`; `ONE(tests/credits.test.ts)` green untouched; SG.
- **Must not change**: guard positions, dialogue, hitbox, labels; the player's mounted offsets.

### N3 Credits, the knight's source, capture [CLAUDE] + OM-S3
- **Tier**: sonnet.
- **Depends**: N2.
- **Files**: `CREDITS.md`, `blender/examples/knight_28541/knight.blend` (**delete**; owner decision D-3 of 2026-11-14), `blender/examples/knight_28541/LICENSE.txt` (its "Used by" lines updated; the file stays), `docs/superpowers/baseline/models/s3/`.
- **Change**: move the knight's row to a "source removed; credit kept" part, keeping the words `tests/credits.test.ts` reads. In-engine capture of `model-guards`, with the perf HUD's draw calls at the gate before and after.
- **Accept**: `ONE(tests/credits.test.ts)` and `ONE(tests/model-licences.test.ts)` pass; SG. Then **OM-S3**.
- **Must not change**: every other credit row; the other licence files.

---

## Slice 4: monsters on clips; dragon, Ashmantle, demon

### M1 Motion tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: H7 (the biped library), R0 items 11 and 12.
- **Files**: `tests/monster-motion.test.ts` (new).
- **Change**: `every model key has a motion row`; `a row without clips reproduces the old branch's pivot rotations and body lift at progress 0, 0.5 and 1` (the numbers of `monsterMeshes.ts` 813-843 written into the test); `every bone a row names exists on that model's skeleton and has weight on at least one vertex` (skipped by name for models that are still rigid); `the goblin plays the hero file's Walk and Slash: a leg bone turns, and every bone keeps its own rest translation`; `the Hips position track is scaled by the model's hip height over the hero's`; `while winding up, the attack clip's time is progress times its anticipation time and it does not advance on its own`; `on release it plays to the end`; `Stage 4's lean, flinch and knock-back offsets are present on the bones after the animator's update`; `hit stop: the animator does not advance during the frozen time`; `a model whose row names Death plays it within the dying state's length` (R0 item 12); `the table imports nothing from three`.
- **Accept**: red until M1b.
- **Must not change**: `src/`.

### M1b Motion table and the monster animator [AGY]
- **Tier**: sonnet; opus verify.
- **Depends**: M1.
- **Files**: `src/data/monsterPoses.ts` (new, pure: per model key either today's code-pose numbers or the names of the clips for idle, walk, attack, hurt and death, the skeleton it stands on and an optional arm-swing scale), `src/engine/monsterMeshes.ts` (`poseMonsterLimbs` reads the table; for a row with clips it drives an animator instead), `src/engine/blenderMonsters.ts` (on upgrade, a model whose row names clips gets a `BlenderHeroAnimator` over the library of its skeleton: the hero file's clips for bipeds, `monsters.glb`'s for the others; the `Hips` track scaled once per model key and cached), `src/engine/loop.ts` (the animator's update, after which Stage 4's offsets are applied at the place R0 item 11 names).
- **Change**: design 6.1.3 and 6.5. The goblin raider's row names `Idle`, `Walk`, `Slash`, `Death` (and `Hurt` if N-6); every other row keeps today's numbers until its figure is rebuilt. Libraries from `monsters.glb` are stripped of their authoring figure's prefix once, when cached (`stripClipPrefix`, S1b). `Walk`'s time scale is multiplied by the hero's leg length over the model's (design 6.5), cached with the scaled `Hips` track.
- **Accept**: `ONE(tests/monster-motion.test.ts)` passes; SG; CAPTURE at the goblin camp of the raider walking, winding up, striking and dying with the hero's clips, beside the still-rigid archers. **This is the first time a shared clip is seen on a figure with another stance** (design 15): if the goblin over-reaches or loses its hunch, its row gets an arm-swing scale or a stance offset here, before any other biped follows. This capture goes to the owner with OM-S4, and earlier on request: it is where reuse first shows.
- **Must not change**: flinch, walk and idle numbers of code-posed rows; Stage 4's reaction timings; the seven existing pivot fields of the rig; any rule (`src/state/`).

### B1 Look fields `kit` and `body` [CLAUDE] test, then [AGY]
- **Tier**: sonnet for both.
- **Depends**: R0, S1b.
- **Files**: `tests/monster-kits.test.ts`, `tests/monster-body.test.ts` (new, written and committed first), then `src/engine/blenderMonsters.ts`, the file holding `MonsterDef` (named by R0; two optional look fields), the engine call site that passes the def (named by R0).
- **Change**: tests: `a def with kit clones its model's Monster_ node, then adds the children of Kit_<kit> under the bones of the same name (a child named after no bone goes under the root)`; `a def with body clones Monster_<body> instead of Monster_<model key>, strips the body key's prefix from its bones, and its skeleton, motion row, albedo and minimap entry still come from the model key`; `a def with neither is unchanged`; `the model keys of every row equal a snapshot, so Stage 4's tests over model keys still see ten`. Then the implementation, in `upgradeMonsterRigWithGltf` only.
- **Accept**: both tests pass; Stage 4's amended `blender-hero.test.ts` and `new-monsters.test.ts` pass untouched; SG.
- **Must not change**: material rules; Stage 4's `tint`, `modelScale` and `model`.

### D2 The new dragon [CLAUDE]
- **Tier**: **fable** (the hardest shape here, and it defines the dragon skeleton); opus verifies.
- **Depends**: S4, B1.
- **Files**: `build_monsters.py` (the dragon builder, rewritten; the old one and its use of `Dragon-low-rig.blend` removed), `tests/fixtures/model-contract/monsters.json` (the dragon's entry replaced whole: the dragon skeleton of design 6.1.2, bones `elvarg_dragon_<Bone>`).
- **Change**: an original dragon to design section 5 (design K7: no replica of any game's dragon): a low, heavy-shouldered body with a clear line of action, a long neck in two bones, a wedge head with a jaw, horns swept back, four legs outside the body outline, wings whose membrane is its own material, a tail in three bones. Hide, belly, membrane and horn at different values; one glow (the mouth). `organic_body` for trunk, neck, legs and tail; wings and horns built and hard- or blend-weighted by rule; `auto_weights` in a spread pose. 14,000 triangles, at most 4 skinned meshes. Not painted before OM-S2 has accepted the paint layer on the hero.
- **Accept**: BG; turnaround, silhouette, play-distance and worst-pose sheets (neck curled, wings raised and folded, jaw open, tail swept) `--against` shipped under `s4/`; wire bytes of the figure reported against 320 kB (220 kB if N-3); CAPTURE(monsters) at the dragon's lair. If two attempts fail the opus verify's reading of the sheets, the task stops and goes to the owner with the fallback of design 6.2 item 3 (a CC0 or CC-BY rigged base, or the old mesh with its own armature folded onto the dragon rig).
- **Must not change**: `Monster_elvarg_dragon`; the names `elvarg_dragon_HeadGroup`, `_LeftArmPivot`, `_RightArmPivot`, `_LeftLegPivot`, `_RightLegPivot`, `_LWing`, `_RWing`; its in-game size within 5%; the old dragon's source file and licence note under `blender/examples/` (its credit row moves to "not shipped" at D5).

### D2b The dragon library [CLAUDE]
- **Tier**: opus.
- **Depends**: D2, M1b.
- **Files**: `build_monsters.py` (clips on the dragon's armature), `src/data/monsterPoses.ts` (the dragon's row names its clips; **declared**: this replaces the dragon row of M1's "reproduces the old branch" case, whose numbers were never seen on a mesh because the old pivots were empty, critique C1), `tests/monster-motion.test.ts` (that one row), manifest (clips, anticipation times).
- **Change**: `Idle`, `Walk`, `Bite`, `WingBuffet`, `Death` (and `Hurt` if N-6), as pose tables, rotation-only plus `Hips`.
- **Accept**: BG; `monster-motion.test.ts` green for the dragon against the built file; motion strips under `s4/`; CAPTURE(monsters) of the dragon walking, winding up `WingBuffet` under Stage 4's telegraph, biting and dying.
- **Must not change**: as D2; Stage 4's attack rows and timings.

### D3 Ashmantle, its own body [CLAUDE]
- **Tier**: opus.
- **Depends**: D2b.
- **Files**: `build_monsters.py` (a new builder), manifest (node `Monster_ashmantle` on the dragon skeleton, bones `ashmantle_<Bone>`, no clips of its own).
- **Change**: design 5.6: heavier chest, a slag crown fused to the skull, back plates with emissive seams (the `glow` material), a clubbed tail end; ash and ember values at least 15 points from the dragon's. 12,000 triangles, at most 4 skinned meshes. Value and size stay Stage 4's `tint` and `modelScale`.
- **Accept**: BG; silhouette sheet of dragon and Ashmantle side by side (Ashmantle at `modelScale` 1.2) at 85 px: different outlines; worst-pose sheet; `monster-motion.test.ts`: Ashmantle plays the dragon's `Walk` and `Bite`; wire bytes against 275 kB (190 kB if N-3); CAPTURE(monsters) at Ashmantle's arena.
- **Must not change**: the dragon's node; every other builder.

### M3d Lesser demon, rebuilt [CLAUDE]
- **Tier**: opus.
- **Depends**: D3 (same file, serial).
- **Files**: `build_monsters.py` (the demon builder, rewritten; the old one and its use of `RedDevil-Ex.blend` removed), manifest (entry replaced whole: biped skeleton with `LWing`, `RWing`, `TailPivot`, `TailPivot2`), `src/data/monsterPoses.ts` (the demon's row names biped clips).
- **Change**: an original demon on the biped rig: a forward hunch, horns and wings exaggerated, wings centred on the back, the cleaver hard-weighted to `WeaponPivot`, slate and ember values. 7,000 triangles.
- **Accept**: BG; `monster-motion.test.ts` green for the demon; turnaround, worst-pose and silhouette sheets under `s4/`; CAPTURE(monsters) at the pass. Fallback as design 4.6: the CC0 body kept, with its author's weights folded onto the biped rig.
- **Must not change**: `Monster_lesser_demon`, its seven pivot names as bones, in-game height within 5%; the source file and its licence note.

### D4 Model, body and kit test [CLAUDE]
- **Tier**: sonnet.
- **Depends**: D3.
- **Files**: `tests/monster-models.test.ts` (new).
- **Change**: `every MONSTER_TYPES row's model key (or type key) has a Monster_ node with both leg bones or pivots`; `every row's body, if any, has a Monster_ node on the same skeleton as its model`; `every row's kit, if any, has a Kit_ node whose children name bones of that model`; `no row's stats or model key differ from a snapshot taken in this test` (name, level, hitpoints, max hit, attack, defence, drops, model).
- **Accept**: red for the body until D5, for the two kits until K3.
- **Must not change**: `src/`.

### D5 Give the boss its body; promote [AGY], then [CLAUDE, main session] + OM-S4
- **Tier**: sonnet; opus reads the report and the sheets.
- **Depends**: D2b, D3, M3d, D4.
- **Files**: the file holding Stage 4's Ashmantle row (named by R0): `body: 'ashmantle'` and nothing else; then as M0p for `monsters.glb`; `CREDITS.md` (the old dragon's and the Red Devil's rows move to "kept in the repository, not shipped"); sheets under `s4/`.
- **Accept**: TYPES; D4's body case green; Stage 4's tests pass untouched; SG; captures of both lairs and the pass; `ONE(tests/credits.test.ts)` and `ONE(tests/model-licences.test.ts)` green. Then **OM-S4**.
- **Must not change**: every other field, including `model`, `tint` and `modelScale`; every other row; any other shipped file.

---

## Slice 5: start region

### M3a Goblin archer rebuilt, chicken re-rigged [CLAUDE]
- **Tier**: opus.
- **Depends**: D5.
- **Files**: `build_monsters.py` (those two builders), manifest, `src/data/monsterPoses.ts` (the archer's row names biped clips and attacks with `Ranged`; the chicken's row stays code-posed).
- **Change**: archer: the raider's rig and proportions with its own head (ears through the hood), a lighter value, the bow hard-weighted to `OffhandPivot` and held out to the side, a tall quiver. Chicken: today's shape kept, its parts fused into at most 3 skinned meshes on the biped rig (wings on the arm bones, hard weights on beak and comb), 2,500 triangles; its rig row is flagged `code_posed` (exempt from the 20-degree bind rule) and its motion row keeps today's code-pose numbers on bones, because the biped clips do not fit a bird (design 4.6).
- **Accept**: BG; sheets under `s5/`; the roster silhouette sheet shows raider and archer told apart at 85 px; `monster-motion.test.ts` green for both; CAPTURE(monsters) at the goblin camp and the chicken yard.
- **Must not change**: the two node names, their pivot names as bones and positions within 0.05, material name substrings, in-game height within 5%; every other builder.

### M4a Promote monsters, slice 5 [CLAUDE, main session] + OM-S5
- As M0p, sheets under `s5/`; the untouched figures show zero Drift. **Depends**: M3a.

---

## Slice 6: mid game and variants

### M3b Scorpion on the crawler rig, with its library [CLAUDE]
- **Tier**: opus.
- **Depends**: M4a.
- **Files**: `build_monsters.py` (the scorpion builder), manifest (crawler skeleton, clips), `src/data/monsterPoses.ts` (the scorpion's row; **declared** as D2b: it replaces that row of M1's old-numbers case).
- **Change**: today's design kept: plates hard-weighted to their bones, legs at least 0.044 thick with per-leg bones, a tail of three bones, ochre and bone values, 5,000 triangles, at most 3 skinned meshes. Library: `Idle`, `Walk`, `Strike`, `Hurt`, `Death`.
- **Accept**: BG; sheets and motion strips under `s6/`; `monster-motion.test.ts` green; CAPTURE(monsters) at the dunes.
- **Must not change**: as M3a, for the scorpion.

### M3e Dark wizard and dark ranger, rebuilt [CLAUDE]
- **Tier**: opus.
- **Depends**: M3b (same file, serial).
- **Files**: `build_monsters.py` (those two), manifest, `src/data/monsterPoses.ts`.
- **Change**: wizard: hat and sleeves exaggerated, a robe skirt weighted by rule to `Hips` and the leg bones so it swings without clinging, the staff hard-weighted to `WeaponPivot` and held away from the body; attacks with `Cast`. Ranger: a cloak that makes a triangle outline, weighted to `Torso` and `Hips`, bow out, a value clearly lighter than the wizard's; attacks with `Ranged`.
- **Accept**: BG; sheets under `s6/`, the worst-pose sheet showing the skirt and cloak in a stride and a strike; the three told apart from each other and from the goblins on the roster sheet; CAPTURE(monsters).
- **Must not change**: as M3a, for these two.

### K1 Saltback Stalker kit [CLAUDE]
- **Tier**: opus.
- **Depends**: B1, M3b.
- **Files**: `build_monsters.py`, manifest (node `Kit_saltback_stalker`).
- **Change**: design 5.6: salt-crusted back plates, a forked double sting, heavier claws, each a rigid child named after the scorpion bone it rides on; at most 1,200 kit triangles; values 15 points from the scorpion's.
- **Accept**: BG; scorpion and stalker side by side at 85 px: different outlines.
- **Must not change**: `Monster_scorpion`; every other builder.

### K2 Thornwatch Marksman kit [CLAUDE]
- **Tier**: opus.
- **Depends**: K1, M3e.
- **Files**: `build_monsters.py`, manifest (node `Kit_thornwatch_marksman`).
- **Change**: a thorn-wreathed hood, a tall bramble quiver, a longer bow; at most 1,200 kit triangles.
- **Accept**: BG; ranger and marksman side by side at 85 px: different outlines.
- **Must not change**: `Monster_dark_ranger`; every other builder.

### K3 Give the two rows their kits [AGY]
- **Tier**: sonnet.
- **Depends**: K2, D4.
- **Files**: the file(s) holding Stage 4's two variant rows (named by R0).
- **Change**: `kit` becomes `saltback_stalker` and `thornwatch_marksman`. Nothing else.
- **Accept**: TYPES passes; the snapshot of D4 passes (stats and model keys unchanged); Stage 4's tests pass untouched.
- **Must not change**: every other field, including `model`, `tint` and `modelScale`; every other row.

### K4 Promote monsters, slice 6 [CLAUDE, main session] + OM-S6
- As M0p, sheets under `s6/`. **Depends**: K3.

---

## Slice 7: late game

### M3c Hill giant and moss guardian, re-rigged [CLAUDE]
- **Tier**: opus.
- **Depends**: K4.
- **Files**: `build_monsters.py` (those two), manifest, `src/data/monsterPoses.ts`.
- **Change**: giant: today's parts fused into one skin (the stacked-ball joints go), shoulders and hands exaggerated, the club hard-weighted to `WeaponPivot` and carried at the side; its row may scale the arm swing so the arms clear the belly. Guardian: stone and bark blocks hard-weighted (stone does not bend), separated in value by 20 points, the core kept as the one glow.
- **Accept**: BG; sheets under `s7/`; `monster-motion.test.ts` green; CAPTURE(monsters).
- **Must not change**: as M3a, for these two.

### M4c Promote monsters, slice 7 [CLAUDE, main session] + OM-S7
- As M0p, sheets under `s7/`; the roster silhouette sheet holds every figure, all told apart (GM6). **Depends**: M3c.

---

## Slice 8: one path, budgets, hand-off

### X0 Remove the rigid monster path [AGY]
- **Tier**: sonnet.
- **Depends**: M4c.
- **Files**: `src/engine/blenderMonsters.ts`, `src/data/monsterPoses.ts` (rows without clips removed, except rows flagged `code_posed`: the chicken), `src/engine/monsterMeshes.ts` (the code-pose branch of `poseMonsterLimbs` stays only for the procedural placeholder rigs), `tests/skinned-figure.test.ts` (the rigid-in-the-same-file case, created by this plan, now asserts a rigid `Monster_` node is refused with a console warning), `tests/monster-motion.test.ts` (the old-numbers case, created by this plan, removed).
- **Change**: `upgradeMonsterRigWithGltf` requires a skin. The hero's loader keeps both branches (rigid hair and eyes are children of a bone, not a path).
- **Accept**: SG; `grep -n "clone(true)" src/engine/blenderMonsters.ts` prints nothing.
- **Must not change**: the procedural placeholder builders; `lean-rig.test.ts`.

### X2 Final budgets [CLAUDE]
- **Tier**: sonnet.
- **Depends**: all promotes.
- **Files**: `tests/fixtures/model-contract/*.json`.
- **Change**: set every ceiling to design 9.1 and 9.2 as reset at S2: per-figure triangles, skinned meshes and wire bytes; per-file wire bytes; total at most 3,180,000 (2,600,000 if N-3).
- **Accept**: `ONE(tests/model-contract.test.ts)` passes; SG. If a ceiling does not hold, the figure is fixed, not the ceiling; a ceiling is raised only by an owner decision recorded in the design's review log.
- **Must not change**: contract entries (names, bones, clips); any GLB.

### X3 Final check [CLAUDE] + [HUMAN] + OM-F
- **Tier**: opus.
- **Depends**: X0, X2.
- **Files**: `docs/superpowers/baseline/models/final.md` (new), `README.md` (model and credits lines only).
- **Change**: SG; P5 repeated (a full rebuild compares clean against what is now shipped); the after sheets and captures indexed beside the before ones; per-file `curl -H 'Accept-Encoding: br'` sizes from the preview deployment [HUMAN]; Stage 5's start-pose draw calls and triangles and its leak check (GPU resources after 200 attacks and 20 gear swaps) re-captured and set against its budget; the hand-off list of design section 10 written out for Stage 6 and for the follow-up gear stage; the owner plays ten minutes on a real GPU and walks the camps.
- **Accept**: wire total within the X2 ceiling, measured on the preview; Stage 5's budgets still hold; **OM-F**.
- **Must not change**: `src/`, any GLB, any test.

---

## Order and parallelism

```
OM-0 -> R0 -> P1 -> (P2 | P3) -> P4 -> P5 -> V1 -> V2 -> V3, V4 -> (H6 -> H6b) -> F1 -> OM-1
merge-only:  OM-1 -> M0 -> M0p -> OM-S0b
pilot:       (P4 -> S0 -> S1b) | (F1 -> S1) ; M0p, S1 -> S2 ; S1b, S2 -> S3 -> OM-P -> S4 -> (Q1 if N-3)
hero:        OM-P -> H1 -> H2 ; H1, S1 -> H3a -> H3b ; H3a -> H4 ; H3a -> H5 -> H5b -> H7 -> OM-S2
gear, guards: G2 -> G2b -> G6 -> N1 -> N2 -> N3 -> OM-S3
monsters:    H7 -> M1 -> M1b ; S1b -> B1
             S4, B1 -> D2 -> D2b -> D3 -> M3d ; D3 -> D4 ; -> D5 -> OM-S4
             -> M3a -> M4a -> OM-S5 -> M3b -> M3e -> K1 -> K2 -> K3 -> K4 -> OM-S6 -> M3c -> M4c -> OM-S7
close:       all -> X0 -> X2 -> X3 -> OM-F
```

About 58 tasks: 12 in slice 0 (with H6, H6b, F1), 2 in slice 0b, 6 in the pilot (7 with Q1), 8 hero, 6 gear and guards, 9 in slice 4, 2 in slice 5, 6 in slice 6, 2 in slice 7, 3 closing, plus R0. The art tasks (H3a, H3b, H4, D2b, D3, M3a to M3e, K1, K2) are opus; S2 and D2 are fable with an opus verify; pipeline, engine wiring and merging are agy with a sonnet fallback; runs are haiku.

## Risks to the plan

| Risk | Answer |
|---|---|
| The owner rejects the skinned approach at OM-P. | That is what the pilot is for. Slice 0 and the merge-only promotion stay; one figure and one engine branch are reverted; the design is redrawn. Nothing else has started. |
| The pilot's look is rejected but the approach is accepted. | Only S2 is redone; that is why one figure goes first. |
| The paint layer fails in the game at the pilot or at H7. | H6b's flag stays harmless; every `bake_paint` call is dropped; budgets get easier; nothing else moves. |
| The new dragon cannot be reached by script (D2). | The task stops after two attempts and goes to the owner with design 6.2's fallback. Slice 4 can promote Ashmantle and the demon later; the old dragon stays shipped until then, because the loader takes both kinds. |
| The hero's skin shears at shoulders, hips or knees (H3a). | Bones sit at the author's joints in the source's own pose (N-5), as S13 rendered without tears; H3a's worst-pose sheet shows it before any clip is converted; optional `LeftShoulder` and `RightShoulder` bones if the deltoid collapses with an arm raised. |
| `monsters.glb` is promoted seven times and the repository grows by about 30 MB of history. | Accepted; fewer promotions would mean larger, harder reviews. |
| An art task runs long because a look cannot be reached by script. | The task stops at its sheets and goes to the owner with the fallback of CALL-M8. |
| A slice's worktree promotes against a stale manifest. | Rule 0.4: promotions happen on the merged head, one at a time, by the main session. |
| Two load paths live side by side and the rigid one rots, or the skinned one is silently skipped. | `tests/skinned-figure.test.ts` exercises both from one file; `tests/model-contract.test.ts` knows which figures must be skinned at each promotion; X0 removes the rigid monster path. |
| The merge shifts the look of the engine's projected albedo tiles (critique M2). | Every merge promotion (M0p, G6) and every skinned figure is judged on an in-engine capture; the material-family tests do not judge the look. |
| Stage 4's model-key tests break. | Model keys never change; `kit` and `body` are separate look fields (B1, D5, K3), and B1's accept runs Stage 4's tests untouched. |
| Stage 4's reactions fight the mixer on clip-driven monsters. | R0 item 11 names where they are applied; M1 asserts they are present after the animator's update; the capture of M1b shows a flinch during a walk. |

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

### Revision of 2026-11-14: owner decisions

The owner answered the design's decisions (design 13.1); the plan was re-cut for them. The design's review log says what changed there.

| Area | Change to this plan | Why |
|---|---|---|
| Gate | OM-0 now asks only the four new decisions N-1 to N-4; the ten answered ones are recorded in the design | They are decided |
| Pilot | New slice 1: S0 (skinned-path tests), S1 (figure kit: rigs, bodies, weights, clips), S1b (the engine's skinned path), S2 (the goblin raider rebuilt and skinned, two body routes, two material variants), S3 (in the game), **OM-P**, S4 (promotion) | One figure goes through the whole chain before anything else commits; it replaces the old pattern task M2 |
| Figure kit | Old H2 split into F1 (merge, paint, export; slice 0) and S1; `joint_cap`, `cut_by_weights`, `decimate_to`, `pose_rest` and `pose_armature` dropped; `make_rig`, `organic_body`, `auto_weights`, `hard_weights`, `fold_weights`, `merge_by_family`, `make_clip` added | Skinned figures; no rigid joints to cap; no third-party body to cut |
| Hero | H3a is now the skin (author's weights folded onto the biped rig) with the ten clips keyed on bones; H2 moves gear mounting into one function before anything changes; H4a (the stepped against smooth spike) and OM-H4a dropped; H4 authors the twelve-clip biped library; H5 carries the **two** declared replacements; H5b puts the hero on the skinned path | Answers 1, 3, 4 and 8 |
| Tests | `tests/skinned-figure.test.ts`, `tests/gear-mount.test.ts`, `tests/monster-motion.test.ts`, `tests/monster-body.test.ts`, `tests/model-pack.test.ts` added; P1 and P4 gain skin cases; rule 0.3.3 names both replacements | Design 8.3 |
| Gear | G1, G3, G4, G5, G5b (bands, gear to budget, band shapes and lookup) moved to the follow-up stage; G2, G2b, G6 (merge only) stay | Decision N-2; the guards need the merge |
| Guards | N-alt (keep the knight) removed; N3 deletes `knight.blend` | Answers 5 and 9 |
| Monster motion | M1 and M1b become the motion table **and** the monster animator over shared clip libraries, with Stage 4's wind-up as the attack clip's anticipation | Answer 1: reuse |
| Dragons | D2a and D2b (cut the old dragon by its armature, reduce and dress it) replaced by D2 (a new dragon, fable) and D2b (the dragon library); D3 is Ashmantle's own body, not a kit; D1b becomes B1 with a second look field `body`; D5 sets `body` on the boss row | Answer 2 |
| Monsters | M2 replaced by the pilot; M3d rebuilds the demon instead of cutting it; M3a to M3e follow design 4.6 (rebuilt or kept, re-rigged); slice order: dragons and demon first among the monsters | Answers 2 and 7 |
| Closing | X0 removes the rigid monster path; X1 (shape studies) removed; X2's total is 3,180,000, or 2,600,000 with N-3 | Migration ends in one path; budget redone from measurement |
| Compression | Q1 (8-bit normals, weights and colour in the promote step) added, conditional on N-3 | Design 9.2 |
| Kept from the critique | P1 to P5, V1 to V4, H6, H6b, the manifest per file, CAPTURE at every art task, the merge-only pass M0 and M0p, model keys never changing | Still apply |
| Tiers | Fable stages are S2 and D2, each with its reason in 0.1; verifies stay opus | Owner model rules |
| Self-review before the commit | H3a converts the clips for the bone chain and proves it with a mechanical orientation check; rigs carry a reference pose and a 20-degree bind bound; the mount fixture is in the mount bone's local space; a pending manifest keeps the suite green between an art task and its promotion; the bone prefix is the node's key | The hero's pivots are siblings today; the probe did not vary the bind pose; the shipped rest pose is not neutral |

### Second-pass check (2026-11-14)

An independent check of the revision (critique file, section "Second pass"; design 3.5 S14 to S17).

| Task | Change | Why |
|---|---|---|
| 0.3.3, OM-0, 0.5 | Three declared replacements (shoulder x added); OM-0 asks N-5 and N-6; `Hurt` skipped under N-6's recommended answer | The hero's joints move to the author's; `Hurt` was not asked for |
| S0, S1, S1b | Skinned roots at the origin, refused otherwise; clips keyed as quaternions from the sample functions' `YZX` order; no re-pose step; track prefixes stripped per library; shells bound with the bind matrix and given their own culling sphere; spheres set on the template | Measured: 6.32 units off; 0.34 rad off in `XYZ`; a shell bound without the bind matrix moved another instance |
| S2, M3a | Monster pivot positions follow the new body; the chicken stays code-posed | No engine code reads a monster pivot's position; the biped clips do not fit a bird |
| S3, OM-P | Six go/no-go criteria, a shared-clip check on the goblin, close crops; three outcomes | The gate had no stated criteria, and shared motion on another stance was first seen only at M1b |
| H1, H3a, H5, H5b | Mount fixture in the figure's space at the reference pose; bones at the author's joints in the source pose; `SpinSlash` exception; only the legs' position keys go to `Hips`; foot-height check; every mount offset moved by the joint's move | `LEAN_RIG`'s pivots are 8 to 11 cm from the author's joints; torso keys on `Hips` would sink the feet in `Lunge` |
| H4, M1b, D2b, X0, R0 | `Lunge` thrust re-made; `Walk` time scale by leg length; chicken row kept by X0; R0 items 16 and 17 | Foot slide on shorter legs; one shared engine file between clusters |

