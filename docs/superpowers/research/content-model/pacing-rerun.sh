#!/bin/bash
# Stage 3's pacing proof under the aggression rule of design 7.13 (pacing-results.txt).
# It runs Stage 3's own tests/pacing.test.ts, UNEDITED, from the working tree (R0, 2026-11-26: the merged tree of
# Stages 1 to 5 and the models pass; PACE_REF=<ref> reads a git ref instead, where git works), bundled with a stand-in for vitest (vitest-stub.ts).
# G1 landed the new rule in tests/support/pacingModel.ts (its `attackers` line reads tests/support/packAttackers.ts), so the blocks are:
#   0. committed:   the model as it is on the tree, unpatched (G1's rule, SIGHT_GAP 10).
#   1. before:      Stage 3's model, rebuilt by reversing G1's line and import. Must reproduce the table in its baseline document.
#   2. convention:  on block 1's model, one modelling change alone: the pack of a type is counted over camps that do not keep their sight
#                   (the pass sentries are a gate, not a training ground). Stage 2's rule otherwise. Shows what the
#                   convention moves by itself.
#   3. after:       the new rule at a given gap: G1's `attackers` line with aggro.ts's packAttackers, which takes the gap
#                   (the lever of CALL-6.27). At gap 10 it must equal block 0 line for line, or the script stops.
#                   The convention of block 2 is not part of the rule (the second-pass check: it changes no number).
# Only tests/support/pacingModel.ts is patched. The script stops (exit 2) if an anchor is not found exactly once, and
# exits 1 unless every block ends with EVERY ASSERTION OF pacing.test.ts HOLDS.
# The test suite is not run: this is the model, under the same 1 GB cap as run.sh.
# Usage, from the repository root, behind the memory cap: scripts/capped.sh bash docs/superpowers/research/content-model/pacing-rerun.sh [gap ...]
# With no argument it runs the chosen gap (10, aggro.ts SIGHT_GAP) and, for the owner to see the lever, 5 and 20.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
ref="${PACE_REF:-}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
if [ -n "$ref" ]; then
  git -C "$root" archive "$ref" src tests/support tests/pacing.test.ts | tar -x -C "$tmp"
  label="$ref at $(git -C "$root" rev-parse --short "$ref")"
else
  tar -C "$root" -c src tests/support tests/pacing.test.ts | tar -x -C "$tmp"
  label="the working tree"
fi
ln -s "$root/node_modules" "$tmp/node_modules"
cp "$here/aggro.ts" "$tmp/tests/support/aggro.ts"
cp "$here/vitest-stub.ts" "$tmp/vitest-stub.ts"
model="$tmp/tests/support/pacingModel.ts"
cp "$model" "$tmp/pacingModel.orig.ts"
bundle_and_run() { # $1 = gap
  "$root/node_modules/.bin/esbuild" "$tmp/tests/pacing.test.ts" --bundle --platform=node --format=esm --log-level=error \
    --alias:vitest="$tmp/vitest-stub.ts" --define:__SIGHT_GAP__="$1" --outfile="$tmp/tests/support/run.mjs"
  env -i HOME="$HOME" PATH="$PATH" node --max-old-space-size=1024 "$tmp/tests/support/run.mjs"
}
patch_model() { # $1 = committed | before | convention | after
  cp "$tmp/pacingModel.orig.ts" "$model"
  [ "$1" = committed ] && return 0
  node - "$model" "$1" <<'JS'
const fs = require('fs');
const [file, mode] = process.argv.slice(2);
let s = fs.readFileSync(file, 'utf8');
const swap = (from, to) => { if (s.split(from).length !== 2) { console.error('pacing-rerun: anchor not found exactly once: ' + from); process.exit(2); } s = s.replace(from, to); };
const line = "const attackers = packAttackers(pack, m, combatLevel(state));";
const imp = "import { packAttackers } from './packAttackers';\n";
if (mode === 'before' || mode === 'convention') {
  swap(line, "const attackers = pack > 0 && monsterThreatColor(m.level, combatLevel(state)) !== 'green' ? pack : 1;");
  swap(imp, "import { monsterThreatColor } from '../../src/state/adventure';\n");
}
if (mode === 'convention') {
  swap("if (camp.aggressive) largestAggressive[type]", "if (camp.aggressive && !KEEPS_SIGHT.includes(camp.id)) largestAggressive[type]");
  s = "import { KEEPS_SIGHT } from './aggro';\n" + s;
}
if (mode === 'after') {
  swap(line, "const attackers = packAttackers(pack, m.level, m.style, combatLevel(state), __SIGHT_GAP__);");
  swap(imp, "import { packAttackers } from './aggro';\ndeclare const __SIGHT_GAP__: number;\n");
}
fs.writeFileSync(file, s);
JS
}
out="$here/pacing-results.txt"
block() { # $1 = title, $2 = patch mode, $3 = gap, $4 = name of the block's own copy in $tmp
  echo >> "$out"; echo "=== $1" >> "$out"
  patch_model "$2" >> "$out" 2>&1 || { cat "$out"; echo "pacing-rerun: patch '$2' failed" >&2; exit 2; }
  bundle_and_run "$3" > "$tmp/block-$4" 2>&1 || { cat "$tmp/block-$4" >> "$out"; cat "$out"; echo "pacing-rerun: block '$1' did not run" >&2; exit 1; }
  cat "$tmp/block-$4" >> "$out"
}
gaps=("$@"); [ ${#gaps[@]} -eq 0 ] && gaps=(10 5 20)
echo "Stage 3's tests/pacing.test.ts from $label, unedited, on the pacing model as committed and on three variants." > "$out"
block "0. committed: the model on the tree, unpatched (G1: packAttackers, SIGHT_GAP 10)" committed 10 committed
block "1. before: Stage 3's model (G1's attackers line and import reversed)" before 10 before
block "2. convention only: the pack is counted over camps that do not keep their sight; Stage 2's rule otherwise" convention 10 convention
for g in "${gaps[@]}"; do
  block "3. after: aggressive camps attack at every level, sight shrinking over $g combat levels (aggro.ts)" after "$g" "after-$g"
done
want=$((3 + ${#gaps[@]}))
holds=$(grep -c "^EVERY ASSERTION OF pacing.test.ts HOLDS$" "$out" || true)
[ "$holds" -eq "$want" ] || { cat "$out"; echo "pacing-rerun: $holds of $want blocks hold" >&2; exit 1; }
if [ -f "$tmp/block-after-10" ]; then
  cmp -s "$tmp/block-committed" "$tmp/block-after-10" || { echo "pacing-rerun: block 3 at gap 10 differs from the committed model" >&2; exit 1; }
  echo "Block 3 at gap 10 is identical to block 0, line for line." >> "$out"
fi
grep -c "" "$out"
