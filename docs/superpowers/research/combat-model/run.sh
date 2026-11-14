#!/bin/bash
# Stage 4 combat model. Bundles each script with the repo's own esbuild (they import the real tables and
# pure functions of src/), runs it under a memory cap with an empty environment and writes its output:
#   model.ts      -> results.txt            timing rule, ordinary monsters, wind-ups cleared, path cost
#   check.ts      -> check-results.txt      the positional boss fight (fight.ts, data in boss.ts)
#   decisions.ts  -> decisions-results.txt  what a death costs, the gate with regeneration, the boss arena
# The environment is empty on purpose: no variable reaches the scripts, so the committed output is the default run.
# Usage, from the repository root: bash docs/superpowers/research/combat-model/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
for name in model check decisions; do
  "$root/node_modules/.bin/esbuild" "$here/$name.ts" --bundle --platform=node --format=esm --log-level=warning --outfile="$out/$name.mjs"
done
run() {
  env -i HOME="$HOME" PATH="$PATH" XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-}" DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-}" \
    systemd-run --user --scope -q -p MemoryMax=1G -p MemorySwapMax=0 node "$out/$1.mjs"
}
run model | tee "$here/results.txt"
run check | tee "$here/check-results.txt"
run decisions | tee "$here/decisions-results.txt"
