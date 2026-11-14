# Stage 7, part 1, model compression: implementation plan

Date: 2026-11-14. Branch: `feat/reach` (cut from `main` at `d69c300`, plus the study commit `45bb05f`). Design: `docs/superpowers/specs/2026-11-14-reach-compression-design.md` (called "the design" below; section numbers refer to it). Line numbers are at `45bb05f`.

The design is still a proposal. Nothing in this plan starts before owner step **O-1**.

---

## 0. Conventions

### 0.1 Task tags and tiers

- **[AGY]**: specified fully enough to hand to agy through `/agy-implement`, in one worktree, because the tasks are serial. It always runs in three stages:
  1. A **haiku** stage runs the `agy -p` command and returns the diff stat, the test output and the exit status.
  2. A **sonnet** stage implements the task only if agy failed or refused, and records that it did.
  3. An **opus** verify stage checks the diff against the task's file allowlist, runs the Accept check, and looks for weakened or deleted assertions and for edits to [CLAUDE] tests.
  On an [AGY] task, "Tier" names the tier that does the work if agy fails. The verify stage is always opus and is part of the task.
- **[CLAUDE]**: tests that define acceptance, licensing text, anything run against the live game or deployment, and every verification.
- **[OWNER]** and **[HUMAN]**: a decision only the owner can make, or something a person has to look at. These are not agent tasks.
- Agents never merge, tag, push or open pull requests. The main session does that after verification. No commit carries an AI attribution trailer of any kind (owner's global rule).

### 0.2 Commands

Run every command from the worktree root, in a shell started with an allowlisted environment: `env -i HOME="$HOME" PATH="$PATH" XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" bash`. `scripts/capped.sh <cmd>` does the same plus the memory cap.

| Name | Command | Expected |
|---|---|---|
| SUITE | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx vitest run` | exit 0; every test passes |
| ONE(file) | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx vitest run <file>` | as stated in the task |
| TYPES | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx tsc --noEmit` | exit 0, no output |
| BUILD | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npm run build` | exit 0 |
| COMPRESS | `scripts/capped.sh npm run models:compress` | exit 0; one line per model |
| CHECK | `scripts/capped.sh node scripts/compress-models.mjs --check` | exit 0, writes nothing |

**Standard gate (SG)**: SUITE, TYPES and BUILD all pass. Every task below ends with SG unless it says otherwise. An OOM kill under the wrapper is a defect to fix. Never raise the cap.

### 0.3 Rules that apply to every task

1. **Allowlist.** A task touches only the files listed for it. The opus verify rejects a diff that contains any other file.
2. **Existing tests are frozen.** No edit to any file that exists today under `tests/` or `src/__tests__/`. That includes `src/__tests__/blender-hero.test.ts`, which keeps parsing the masters with a bare loader, and `tests/gltf-loader.test.ts`. New tests go in new files under `tests/`.
3. **Test-first window.** C1 makes the suite red until C5 lands. Allowed in that window:
   - SUITE failures only in `tests/model-compression.test.ts`;
   - TYPES and BUILD errors only in that file, and only "has no exported member 'createGltfLoader'" until C4.
   The opus verify of C1 lists the expected failures. Any other error is a defect. C5's Accept restores full SG.
4. **Masters are read-only.** No task writes `public/models/{hero,gear,monsters,world,guard}.glb`, runs a `blender:*` script, or edits `scripts/blender/`.
5. **Stage 2 files are not touched** (design section 7). The only exception is task C7, which runs after Stage 2 has merged.
6. **No runtime dependency.** New packages go to `devDependencies` with exact versions (`--save-exact`).
7. **Commit messages** name a kind and the finding: `test(#27): ...`, `build(#27): ...`, `assets(#27): ...`, `feat(#27): ...`, `perf(#27): ...`, `docs(#27): ...`. One task, one commit.

### 0.4 Branch

Everything runs serially on `feat/reach` in the worktree `osrs-like-wp/S7`. There are no parallel clusters: each task depends on the one before it. Run at most one BUILD at a time on this machine.

### 0.5 Owner and human steps

| Step | What | Blocks |
|---|---|---|
| O-1 | Approve the design and answer D1 to D9 (design section 8). | Everything |
| H-2 | [HUMAN] Compare the before and after screenshots of each model. | O-2 |
| H-3 | [HUMAN] Record load time before and after on the owner's machine. | O-2 |
| O-2 | Accept this part. The main session opens the pull request. | Merge |
| O-3 | Stage 2 (`feat/world-place`) has merged to `main`. | C7 |

If an owner answer takes the alternative, these tasks change:
- **D1, plain quantization:** C2 drops `meshoptimizer` and the `EXTMeshoptCompression` line. C1 drops M-2's bare-loader rejection and replaces it with "a bare loader parses the file". M-3 drops "non-interleaved", because plain output interleaves position and UV (measured), and compares values with `getComponent`. M-4 no longer requires `EXT_meshopt_compression`. C4 is cancelled. Budgets change to raw at most 7,700,000 and q3 at most 3,200,000.
- **D2, 10-bit:** the C2 constant becomes `quantizeNormal: 10`. M-3 asserts `Int16Array` normals. The q3 budget becomes 3,050,000.
- **D4, build time:** a different plan is needed. Stop and re-plan.

---

## 1. Tasks

### H-1 Baseline screenshots, before [CLAUDE]
- **Tier**: sonnet. It drives the browser by a written recipe. Judging the pictures is H-2.
- **Depends**: O-1.
- **Files**: `docs/superpowers/baseline/s7/poses.json` (new), `docs/superpowers/baseline/s7/before-<pose>.png` (new, five files).
- **Change**:
  1. Start `npm run dev` on the current branch head, which still loads the masters.
  2. Open the game with the Playwright MCP browser at a 1280x720 viewport.
  3. Through `window.__DEBUG` (`runtime.ts:190`: `STATE`, `player`, `camState`, `rebuildPlayerEquipmentMeshes`, `ITEMS`), set up five poses and take one screenshot of each:
     - `hero`: close-up of the player in the default kit.
     - `gear`: the player with a full metal set, a weapon and a shield equipped through `STATE` and `rebuildPlayerEquipmentMeshes`. Record the item ids.
     - `monsters`: a camp with at least two species in view.
     - `world`: start-town props, with at least one tree, one rock and one BlendSwap crate or barrel.
     - `guard`: a castle guard in close-up.
  4. Write into `poses.json` everything needed to replay each pose exactly: player position, `camState` fields, item ids, quality tier and anything that sets lighting or the time of day.
- **Accept**: five PNGs plus `poses.json`. The opus verify confirms that every pose shows its model, and that replaying `poses.json` reproduces the same frame (take a second screenshot of one pose and compare).
- **Must not change**: anything outside `docs/superpowers/baseline/s7/`.

### C1 Compression tests [CLAUDE]
- **Tier**: sonnet. The tests are written from design section 6.4.
- **Depends**: H-1.
- **Files**: `tests/model-compression.test.ts` (new).
- **Change**: write tests M-1 to M-7 exactly as design 6.4 specifies.
  - Constant: `NAMES = ['hero', 'gear', 'monsters', 'world', 'guard']`.
  - Parsing: use `loader.parse(arrayBuffer, '', resolve, reject)`, as `blender-hero.test.ts:26-35` does. Do not import from that file.
  - Masters are parsed with a bare `new GLTFLoader()`. Compressed files are parsed with `createGltfLoader()` from `../src/engine/gltf`.
  - M-3 compares the two scenes by traversal index. Triangles are compared after rotating each triangle so its smallest index comes first. Normals are compared by vector distance, at most 0.01.
  - M-4 reads the GLB JSON chunk directly (length at byte 12, JSON from byte 20).
  - M-5 spawns `process.execPath` with `['scripts/compress-models.mjs', '--check']` and `cwd` at the repository root, the same pattern as `tests/run-blender.test.ts`.
  - M-7 uses `zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 3 } })`.
  - Budgets: raw total at most 5,300,000, q3 total at most 2,650,000.
- **Accept**: `ONE(tests/model-compression.test.ts)` fails in every `it`, for the reasons expected in rule 0.3.3: missing files, missing export, missing script. Every other test file passes. The opus verify reads each assertion against design 6.4 and checks that none is weaker than specified: exact equality where 6.4 says exact, `Float32Array` and non-interleaved for position and UV, 0.01 for normals.
- **Must not change**: `src/`, `scripts/`, `public/`.

### C2 Compression script and dev dependencies [AGY]
- **Tier**: sonnet. The script is specified in design 5.2 and 6.2.
- **Depends**: C1.
- **Files**: `scripts/compress-models.mjs` (new), `package.json`, `package-lock.json`.
- **Change**:
  - Run `npm install --save-dev --save-exact @gltf-transform/core@4.5.1 @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1 meshoptimizer@1.3.0`.
  - Add the script `"models:compress": "node scripts/compress-models.mjs"` to `package.json`.
  - Write the script exactly as design 6.2 describes:
    - fixed name list; read `public/models/<name>.glb`;
    - checks for missing file, `glTF` magic and the 32 MiB cap, each with a message naming the file;
    - `new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })`, after `await MeshoptEncoder.ready` and `await MeshoptDecoder.ready`;
    - logger at `Logger.Verbosity.WARN`;
    - the transform and the two `createExtension` lines from design 5.2, verbatim;
    - write `public/models/<name>.meshopt.glb`;
    - `--check` encodes in memory, compares with `Buffer.equals` and writes nothing;
    - exit 0 on success, 1 for stale or missing outputs in `--check`, 2 for any error;
    - one output line per file: name, master bytes, compressed bytes.
  - Do not run the script in write mode in this task.
- **Accept**:
  - `package.json` lists the four packages under `devDependencies` with exact versions and nothing new under `dependencies`.
  - CHECK exits 1 and names all five files as missing.
  - TYPES and BUILD show only the C1-window errors.
  - `npm audit --audit-level=high` exits 0.
- **Must not change**: `dependencies`, any existing npm script, `public/`, `src/`, `tests/`.

### C3 Generate the compressed models [CLAUDE]
- **Tier**: haiku runs COMPRESS and CHECK and reports sizes and hashes. Opus verifies the numbers against the design.
- **Depends**: C2.
- **Files**: `public/models/hero.meshopt.glb`, `gear.meshopt.glb`, `monsters.meshopt.glb`, `world.meshopt.glb`, `guard.meshopt.glb` (all new).
- **Change**: run COMPRESS, then CHECK. Commit the five files.
- **Accept**:
  - CHECK exits 0.
  - Byte sizes equal the design 3 table: 151,372, 1,323,340, 1,597,724, 1,145,072 and 964,108.
  - sha256 prefixes equal design 5.2: `f1d697d674e4`, `3fe63271a048`, `f1ef1996ad4d`, `8161842357a1`, `63f6f44e25cb`.
  - If sizes or hashes differ, stop. Opus finds out why (version drift, or a setting that differs from 5.2) before going on. A difference is not accepted silently.
  - `ONE(tests/model-compression.test.ts)`: M-1, M-4, M-5 and M-7 pass. M-2, M-3 and M-6 still fail.
  - `git status` shows no change to any master.
- **Must not change**: the five masters, `scripts/`, `src/`.

### C4 Meshopt decoder in the shared loader [AGY]
- **Tier**: sonnet.
- **Depends**: C3.
- **Files**: `src/engine/gltf.ts`.
- **Change**: as in design 6.3:
  - import `MeshoptDecoder` from `three/examples/jsm/libs/meshopt_decoder.module.js`;
  - export `createGltfLoader(): GLTFLoader`, which returns `new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)`;
  - `defaultGltfLoad` calls `createGltfLoader().loadAsync(url)`;
  - no workers, no other change.
- **Accept**:
  - `ONE(tests/model-compression.test.ts)`: M-1 to M-5 and M-7 pass. M-6 still fails.
  - `ONE(tests/gltf-loader.test.ts)` and `ONE(tests/architecture.test.ts)` pass.
  - TYPES clean.
- **Must not change**: `loadGltfOnce` (signature, caching, retry on failure, `console.warn` text).

### C5 Point the four loaders at the compressed files [AGY]
- **Tier**: sonnet.
- **Depends**: C4.
- **Files**: `src/engine/blenderHero.ts`, `src/engine/blenderGear.ts`, `src/engine/blenderMonsters.ts`, `src/engine/blenderWorld.ts`.
- **Change**: replace only the default value of each `url` parameter with the "After" column of the design 6.3 table, with no `?v=` query.
- **Accept**:
  - SG fully green: every test, including all of M-1 to M-7 and the unchanged `blender-hero.test.ts`.
  - `git diff HEAD~1 --stat` shows four files with one changed line each.
- **Must not change**: function names, signatures, the `typeof window` guards, `setBlenderGearRoot`, `hasBlenderGearTemplate`, any upgrade function, `src/engine/worldBuild.ts`.

### C6 Credits for the compressed copies [CLAUDE]
- **Tier**: sonnet. This is licensing text.
- **Depends**: C5.
- **Files**: `CREDITS.md`.
- **Change**: add one sentence under "Shipped in the game (`public/models/`)": each `<name>.meshopt.glb` is a compressed copy of `<name>.glb`, made by `scripts/compress-models.mjs`, with the same licence and credit. Do not change the table.
- **Accept**: `ONE(tests/credits.test.ts)` passes unchanged, then SG.
- **Must not change**: the asset table and every existing sentence.

### H-1b Screenshots, after [CLAUDE]
- **Tier**: sonnet. It follows the same recipe as H-1.
- **Depends**: C6.
- **Files**: `docs/superpowers/baseline/s7/after-<pose>.png` (new, five files).
- **Change**: replay `poses.json` on the branch head, with the same browser and viewport. Confirm in the Network panel or through the MCP network log that the four `*.meshopt.glb` files load, and that `guard.glb` (the master) still loads. Confirm that the console has no `[GLTF] Failed to load` warning.
- **Accept**: five PNGs. The network log lists `hero.meshopt.glb`, `gear.meshopt.glb`, `monsters.meshopt.glb`, `world.meshopt.glb` and `guard.glb`, each with status 200. There are no GLTF warnings.
- **Must not change**: anything outside `docs/superpowers/baseline/s7/`.

### H-2 Look comparison [HUMAN]
For each of the five poses, the owner compares `before-<pose>.png` and `after-<pose>.png` side by side and in the running game. Things to look for:
- shading on smooth parts (hero face and arms, monster bodies, guard armour);
- texture tiling on props and gear (projected UVs);
- outline thickness;
- the faceted silhouette;
- pivots during the walk and attack animations.

The result, "same" or a list of differences, goes into the pull request. Any difference triggers the D2 fallback (10-bit normals): C2's constant changes, C3 is re-run, C1's normal type assertion changes as stated in 0.5, and H-1b and H-2 are repeated.

### H-3 Load time [HUMAN]
In Chrome DevTools, with "Fast 4G" throttling and the cache disabled, the owner records for `main` (masters) and for the branch:
- the transferred bytes of the `/models/` requests;
- the time from navigation until the hero model replaces the procedural one.

Recorded in the pull request. It does not gate, but a slower branch is reported to the owner before O-2.

### V-1 Verification [CLAUDE]
- **Tier**: opus (verification).
- **Depends**: H-1b. It runs after H-2 if H-2 reported a difference.
- **Files**: none. It is read-only and writes a report in the session.
- **Check**:
  1. SUITE: every test passes, the new `tests/model-compression.test.ts` included. No test is skipped or marked `.todo`.
  2. TYPES clean, and BUILD exit 0.
  3. CHECK exits 0.
  4. `npm audit --audit-level=high` exits 0.
  5. This three-dot diff (from the merge base, so Stage 2 work on `main` does not show) is empty: `git diff main...HEAD -- src/__tests__ tests/gltf-loader.test.ts tests/run-blender.test.ts tests/credits.test.ts tests/architecture.test.ts scripts/blender scripts/run-blender.mjs src/state src/data public/models/hero.glb public/models/gear.glb public/models/monsters.glb public/models/world.glb public/models/guard.glb`.
  6. `git diff main...HEAD --name-only` lists only:
     - `docs/superpowers/research/2026-11-13-asset-pipeline.md` (the study commit `45bb05f`, already on this branch);
     - `CREDITS.md`, `package.json`, `package-lock.json`;
     - `scripts/compress-models.mjs`;
     - the five `public/models/*.meshopt.glb`;
     - `src/engine/gltf.ts` and the four `src/engine/blender*.ts` files;
     - `tests/model-compression.test.ts`;
     - `docs/superpowers/baseline/s7/*` and the two Stage 7 documents.
     In particular, it lists no Stage 2 file.
  7. `package.json` has no new `dependencies` entry, and the four devDependencies are pinned exactly. BUILD's JS chunk size at C3 and at C4 is recorded in the pull request. The difference is the decoder's cost against Stage 2's 951 kB cap (design D9).
  8. Ledger: finding 27 has commits naming `#27`. The pull request description states:
     - the eager-loading half of finding 27 is kept, with the reason from design 1;
     - finding 29 is deferred (D6), and findings 3 and 39 are left to the pipeline part;
     - **handover to Stage 5**: a future `script-src` CSP must allow `'wasm-unsafe-eval'` for the meshopt decoder (design R5, T6).
  9. CI is green on the pushed branch.
- **Accept**: a written pass. Any failure goes back to its task.
- **Must not change**: anything.

### V-2 Real wire bytes [CLAUDE]
- **Tier**: haiku runs the commands and returns the numbers. V-1's opus judges them.
- **Depends**: V-1, and the main session has pushed `feat/reach`, so that Vercel builds a preview deployment.
- **Files**: none.
- **Change**: for each of the five `<preview-url>/models/<name>.meshopt.glb`, run `curl -sS -H 'Accept-Encoding: br' -o /dev/null -D - -w '%{size_download}\n'`. Record the `content-encoding`, `cache-control` and `content-type` headers and the downloaded bytes.
  - If the preview is behind Vercel deployment protection, the owner supplies a bypass token or the step runs on production after the merge.
- **Accept**:
  - `content-encoding: br` and `content-type: model/gltf-binary` on every file.
  - Total downloaded bytes of the five compressed files at most 2,800,000 (design G1). The pull request records the real total next to the q3 estimate of 2,553,811.
  - The pull request also states that the game still loads `guard.glb` until C7b. The in-game total is therefore about 2.92 MB until then.
  - If it is over the limit, report to the owner. Do not change budgets.
- **Must not change**: anything.

### O-2 Accept this part [OWNER]
The owner reviews V-1, V-2, H-2 and H-3 and accepts. The main session opens the pull request to `main` and merges after CI is green.

---

## 2. After Stage 2 merges: the guard (design section 7)

Nothing here starts before **O-3**. The main session rebases `feat/reach` onto `main` (or cuts `feat/reach-guard` from `main` if `feat/reach` has already merged), resolves any `package-lock.json` conflict with `npm install`, and runs SG.

### C7a Guard URL test [CLAUDE]
- **Tier**: sonnet.
- **Depends**: O-3.
- **Files**: `tests/model-compression-guard.test.ts` (new).
- **Change**: one test, `the guard loader points at guard.meshopt.glb`. It checks that the text of `src/engine/worldBuild.ts` contains `'/models/guard.meshopt.glb'` and does not contain `'/models/guard.glb'`.
- **Accept**: it fails until C7b.
- **Must not change**: `src/`.

### C7b Switch the guard [AGY]
- **Tier**: sonnet.
- **Depends**: C7a.
- **Files**: `src/engine/worldBuild.ts`.
- **Change**: in `loadBlenderGuardTemplate`, replace `'/models/guard.glb'` with `'/models/guard.meshopt.glb'`. No other line changes.
- **Accept**: SG. The diff is one line. The H-1b recipe for the `guard` pose shows `guard.meshopt.glb` loading with no GLTF warning, and the owner compares that one screenshot (H-2 for one pose).
- **Must not change**: any other line of `worldBuild.ts`.

### V-3 Guard verification [CLAUDE]
- **Tier**: opus.
- **Depends**: C7b.
- **Check**: SG, CHECK, the one-line diff, no master changed, and the V-2 curl for `guard.meshopt.glb` on the new deployment.
- **Accept**: a written pass.

---

## 3. Final verification (end of this part, after V-3)

Run on `main` after the last merge, from an allowlisted shell:

1. SUITE passes, with `tests/model-compression.test.ts` and `tests/model-compression-guard.test.ts` included.
2. TYPES is clean, and BUILD exits 0.
3. CHECK exits 0.
4. `npm audit --audit-level=high` exits 0.
5. CI is green on the merge commit.
6. Production `curl` of the five `.meshopt.glb` files: total at most 2,800,000 bytes, every file served with `br`.
7. In the running game: all five models appear (none falls back to its procedural shape), and the console has no `[GLTF]` warning. The H-2 points still hold.

---

## 4. Coverage

### 4.1 Findings

| Finding | Task |
|---|---|
| 27, size half | C1 to C5, C7a and C7b; proofs M-1 to M-7, V-2 |
| 27, eager-loading half | Kept as it is, with the reason given in design 1. Recorded by V-1 step 8. |
| 29 | Deferred (D6). No task. |
| 3, 39 | Out of this part (design 1). No task. |

### 4.2 Goals to proofs

| Goal | Proof task(s) |
|---|---|
| G1 | C1 (M-7), V-2, final step 6 |
| G2 | C1 (M-2, M-6), C4, C5, C7a |
| G3 | C1 (M-3) |
| G4 | H-1, H-1b, H-2, C7b |
| G5 | C1 (M-5), C3 |
| G6 | V-1 steps 5 and 6 |
| G7 | C1 (M-4) |

### 4.3 Task tiers at a glance

| Task | Tag | Work tier | Verify |
|---|---|---|---|
| H-1 | [CLAUDE] | sonnet | opus |
| C1 | [CLAUDE] | sonnet | opus |
| C2 | [AGY] | haiku runs agy; sonnet if agy fails | opus |
| C3 | [CLAUDE] | haiku | opus |
| C4 | [AGY] | haiku runs agy; sonnet if agy fails | opus |
| C5 | [AGY] | haiku runs agy; sonnet if agy fails | opus |
| C6 | [CLAUDE] | sonnet | opus |
| H-1b | [CLAUDE] | sonnet | opus |
| V-1 | [CLAUDE] | opus | |
| V-2 | [CLAUDE] | haiku | opus (in V-1) |
| C7a | [CLAUDE] | sonnet | opus |
| C7b | [AGY] | haiku runs agy; sonnet if agy fails | opus |
| V-3 | [CLAUDE] | opus | |

No task uses fable: nothing here is a system-wide contract or a failed root cause.
