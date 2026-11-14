#!/bin/bash
# Stage 3's pacing proof under the aggression rule of design 7.13 (pacing-results.txt).
# It runs Stage 3's own tests/pacing.test.ts, UNEDITED, from origin/main (Stage 3 merged there; this tree is older;
# PACE_REF overrides the ref), bundled with a stand-in for vitest (vitest-stub.ts), three times:
#   1. before:      Stage 3's model as committed. Must reproduce the table in its baseline document.
#   2. convention:  one modelling change alone: the pack of a type is counted over camps that do not keep their sight
#                   (the pass sentries are a gate, not a training ground). Stage 2's rule otherwise. Shows what the
#                   convention moves by itself.
#   3. after:       the new rule: the pack attacks at every level, scaled by the sight radius (aggro.ts, packAttackers).
#                   Only the `attackers` line is patched (declared replacement 9 of design 11.3): the second-pass check
#                   found that the convention of block 2 changes no number here either, so it is not part of the rule.
# Only tests/support/pacingModel.ts is patched; the script stops if an anchor is missing.
# The test suite is not run: this is the model, under the same 1 GB cap as run.sh.
# Usage, from the repository root: bash docs/superpowers/research/content-model/pacing-rerun.sh [gap ...]
# With no argument it runs the chosen gap (10, aggro.ts SIGHT_GAP) and, for the owner to see the lever, 5 and 20.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
ref="${PACE_REF:-origin/main}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git -C "$root" archive "$ref" src tests/support tests/pacing.test.ts | tar -x -C "$tmp"
ln -s "$root/node_modules" "$tmp/node_modules"
cp "$here/aggro.ts" "$tmp/tests/support/aggro.ts"
cp "$here/vitest-stub.ts" "$tmp/vitest-stub.ts"
model="$tmp/tests/support/pacingModel.ts"
cp "$model" "$tmp/pacingModel.orig.ts"
bundle_and_run() { # $1 = gap
  "$root/node_modules/.bin/esbuild" "$tmp/tests/pacing.test.ts" --bundle --platform=node --format=esm --log-level=error \
    --alias:vitest="$tmp/vitest-stub.ts" --define:__SIGHT_GAP__="$1" --outfile="$tmp/tests/support/run.mjs"
  env -i HOME="$HOME" PATH="$PATH" XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-}" DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-}" \
    systemd-run --user --scope -q -p MemoryMax=1G -p MemorySwapMax=0 node "$tmp/tests/support/run.mjs"
}
patch_model() { # $1 = convention | after
  cp "$tmp/pacingModel.orig.ts" "$model"
  node - "$model" "$1" <<'JS'
const fs = require('fs');
const [file, mode] = process.argv.slice(2);
let s = fs.readFileSync(file, 'utf8');
const swap = (from, to) => { if (!s.includes(from)) { console.error('pacing-rerun: anchor not found: ' + from); process.exit(2); } s = s.replace(from, to); };
if (mode === 'convention') swap("if (camp.aggressive) largestAggressive[type]", "if (camp.aggressive && !KEEPS_SIGHT.includes(camp.id)) largestAggressive[type]");
if (mode === 'after') swap("const attackers = pack > 0 && monsterThreatColor(m.level, combatLevel(state)) !== 'green' ? pack : 1;",
  "const attackers = packAttackers(pack, m.level, m.style, combatLevel(state), __SIGHT_GAP__);");
s = "import { KEEPS_SIGHT, packAttackers } from './aggro';\ndeclare const __SIGHT_GAP__: number;\n" + s;
fs.writeFileSync(file, s);
JS
}
gaps=("$@"); [ ${#gaps[@]} -eq 0 ] && gaps=(10 5 20)
{
  echo "Stage 3's tests/pacing.test.ts from $ref at $(git -C "$root" rev-parse --short "$ref"), unedited, three models."
  echo; echo "=== 1. before: Stage 3's model as committed"
  bundle_and_run 10
  echo; echo "=== 2. convention only: the pack is counted over camps that do not keep their sight; Stage 2's rule otherwise"
  patch_model convention; bundle_and_run 10
  for g in "${gaps[@]}"; do
    echo; echo "=== 3. after: aggressive camps attack at every level, sight shrinking over $g combat levels (aggro.ts)"
    patch_model after; bundle_and_run "$g"
  done
} > "$here/pacing-results.txt" 2>&1 || { cat "$here/pacing-results.txt"; exit 1; }
grep -c "" "$here/pacing-results.txt"
