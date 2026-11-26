#!/bin/bash
# Second-pass check of the 2026-11-14 revision (critique file, "Second pass"): second-pass-check.ts -> second-pass-results.txt.
# It reads the game's code from the working tree (R0, 2026-11-26; a git ref as argument reads that ref instead), and patches the
# aggression rule of aggro.ts into a COPY of main's src/state/monsterAi.ts, with the same two anchors as run.sh.
# Usage, from the repository root, behind the memory cap: scripts/capped.sh bash docs/superpowers/research/content-model/second-pass.sh [ref]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
ref="${1:-}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/main"
if [ -n "$ref" ]; then
  git -C "$root" archive "$ref" src | tar -x -C "$tmp/main"
  label="$ref at $(git -C "$root" rev-parse --short "$ref")"
else
  tar -C "$root" -c src | tar -x -C "$tmp/main"
  label="the working tree"
fi
cp "$here/aggro.ts" "$tmp/aggro.ts"
cp "$here/second-pass-check.ts" "$tmp/second-pass-check.ts"
node - "$tmp/main/src/state/monsterAi.ts" "$tmp/main/src/state/monsterAi.patched.ts" <<'JS'
const fs = require('fs');
const [src, dst] = process.argv.slice(2);
let s = fs.readFileSync(src, 'utf8');
const swap = (from, to) => { if (s.split(from).length !== 2) { console.error('second-pass: anchor not found exactly once: ' + from); process.exit(2); } s = s.replace(from, to); };
swap("    world.playerCombat != null &&\n    monsterThreatColor(m.level, world.playerCombat) !== 'green'\n", "    world.playerCombat != null\n");
swap("const aggroRadius = camp.aggroRadius ?? (m.style === 'magic' || m.style === 'ranged' ? 12 : 9);",
  "const aggroRadius = sightRadius(camp.aggroRadius ?? (m.style === 'magic' || m.style === 'ranged' ? 12 : 9), m.level, world.playerCombat, KEEPS_SIGHT.includes(camp.id));");
s = "import { KEEPS_SIGHT, sightRadius } from '../../../aggro';\n" + s;
fs.writeFileSync(dst, s);
JS
"$root/node_modules/.bin/esbuild" "$tmp/second-pass-check.ts" --bundle --platform=node --format=esm --log-level=warning --outfile="$tmp/c.mjs"
{
  echo "Second-pass check against $label"
  env -i HOME="$HOME" PATH="$PATH" node --max-old-space-size=1024 "$tmp/c.mjs"
} > "$here/second-pass-results.txt"
tail -n 1 "$here/second-pass-results.txt"
