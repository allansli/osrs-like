import sys; sys.path.insert(0, sys.argv[1])
from lib import Doc
p = Doc('/path/to/osrs-like-wp/MP/docs/superpowers/plans/2026-11-14-models-pass-plan.md')
p.sub("The next promotion of the same file; the slice's merge |\n\n| OM-F", "The next promotion of the same file; the slice's merge |\n| OM-F")
p.sub("`curl` of the preview deployment (X3) |\n\n| GM9", "`curl` of the preview deployment (X3) |\n| GM9")
p.sub("5. **Contracts change only with the manifest.** A task that adds a node, pivot, clip or `extras` key edits its file's manifest, `tests/fixtures/model-contract/<file>.json`, in the same commit and says so.",
"5. **Contracts change only with the manifest.** A task that adds a node, pivot, bone, clip or `extras` key edits its file's manifest in the same commit and says so. Because `tests/model-contract.test.ts` checks the **shipped** files against `tests/fixtures/model-contract/<file>.json` on every run, a task that changes a contract before its file is promoted writes the change to `tests/fixtures/model-contract/pending/<file>.json` (a full copy with the change); COMPARE checks the built file against the pending manifest when one exists, and the promote task moves it over the live one in the same commit as the GLB. SUITE therefore stays green between an art task and its promotion. \"Manifest\" in a task's file list means the pending one until that promotion.")
p.sub("| CAPTURE(name) | In a throw-away worktree of the task's head: copy `scratch/models-build/<name>.glb` over `public/models/<name>.glb`, take the slice's in-engine poses as V4 does, delete the worktree |",
"| CAPTURE(name) | In a throw-away worktree of the task's head: copy `scratch/models-build/<name>.glb` over `public/models/<name>.glb` and any pending manifest over its live one, take the slice's in-engine poses as V4 does, delete the worktree. Every \"in a throw-away worktree\" test run in this plan is set up the same way |")
p.sub("| COMPARE(name) | `node scripts/models-compare.mjs scratch/models-build/<name>.glb public/models/<name>.glb` | exit 0 = Contract (built file against `tests/fixtures/model-contract/<name>.json`) and Budget pass;",
"| COMPARE(name) | `node scripts/models-compare.mjs scratch/models-build/<name>.glb public/models/<name>.glb` | exit 0 = Contract (built file against `tests/fixtures/model-contract/pending/<name>.json` if it exists, else `tests/fixtures/model-contract/<name>.json`) and Budget pass;")
p.sub("`one more triangle than the budget fails Budget`;", "`one more triangle than the budget fails Budget`; `a pending manifest, when present, is the one compared against, and promote moves it over the live one`;")
p.save()
d = Doc('/path/to/osrs-like-wp/MP/docs/superpowers/specs/2026-11-14-models-pass-design.md')
d.sub("generated once from today's shipped files and edited only by tasks that declare the change.", "generated once from today's shipped files and edited only by tasks that declare the change. A change made before its file is promoted is written to a pending copy (`model-contract/pending/<file>.json`), which the compare uses and the promotion moves into place, so the shipped files always match the live manifest.")
d.save(); print('ok')
