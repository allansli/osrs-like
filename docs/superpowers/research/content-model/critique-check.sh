#!/bin/bash
# The Stage 6 critique's independent re-check (critique-check.ts -> critique-results.txt). Same bundling and memory cap as run.sh.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
"$root/node_modules/.bin/esbuild" "$here/critique-check.ts" --bundle --platform=node --format=esm --log-level=warning --outfile="$out/c.mjs"
env -i HOME="$HOME" PATH="$PATH" XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-}" DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-}" \
  systemd-run --user --scope -q -p MemoryMax=1G -p MemorySwapMax=0 node "$out/c.mjs" | tee "$here/critique-results.txt"
