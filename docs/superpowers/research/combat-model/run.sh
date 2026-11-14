#!/bin/bash
# Stage 4 combat model. Bundles model.ts with the repo's own esbuild (it imports the real tables and
# pure functions of src/), runs it under a memory cap with an empty environment, writes results.txt.
# Usage, from the repository root: bash docs/superpowers/research/combat-model/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
"$root/node_modules/.bin/esbuild" "$here/model.ts" --bundle --platform=node --format=esm --log-level=warning --outfile="$out/model.mjs"
env -i HOME="$HOME" PATH="$PATH" XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-}" DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-}" \
  systemd-run --user --scope -q -p MemoryMax=1G -p MemorySwapMax=0 node "$out/model.mjs" | tee "$here/results.txt"
