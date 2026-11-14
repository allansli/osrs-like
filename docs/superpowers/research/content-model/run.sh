#!/bin/bash
# Stage 6 content model. Bundles each script with the repo's own esbuild (they import the real tables and pure
# functions of src/), runs it under a memory cap with an empty environment and writes its output:
#   model.ts -> results.txt        loops, the 2.5 rule, drops, skills on the XP curve, gear ladders, placement,
#                                  dungeon geometry, names, save size, hours
#   check.ts -> check-results.txt  the three new bosses through Stage 4's positional fight
# content.ts holds the proposal as data (and the Stage 3 and Stage 4 numbers this tree does not have yet).
# fight.ts and boss.ts are copies from branch feat/combat-weight at 732cb8c (see the header of fight.ts).
# Usage, from the repository root: bash docs/superpowers/research/content-model/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
for name in model check; do
  "$root/node_modules/.bin/esbuild" "$here/$name.ts" --bundle --platform=node --format=esm --log-level=warning --outfile="$out/$name.mjs"
done
run() {
  env -i HOME="$HOME" PATH="$PATH" XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-}" DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-}" \
    systemd-run --user --scope -q -p MemoryMax=1G -p MemorySwapMax=0 node "$out/$1.mjs"
}
status=0
run model | tee "$here/results.txt" || status=1
run check | tee "$here/check-results.txt" || status=1
exit $status
