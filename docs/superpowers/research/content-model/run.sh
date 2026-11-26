#!/bin/bash
# Stage 6 content model. Bundles each script with the repo's own esbuild (they import the real tables and pure
# functions of src/), runs it with an empty environment and a 1 GB heap (the 3 GB cap is scripts/capped.sh's) and writes its output:
#   model.ts -> results.txt        loops, the 2.5 rule, drops, skills on the XP curve, gear ladders, placement,
#                                  dungeon geometry, names, save size, hours
#   check.ts -> check-results.txt  the three new bosses and Stage 4's Ashmantle through Stage 4's positional fight,
#                                  each row with today's attack formula and with the style rebalance
#   aggro-check.ts -> aggro-results.txt  the aggression rule (aggro.ts): the radius function, Stage 2's stepMonster with
#                                  the rule patched into a COPY of src/state/monsterAi.ts, and Stage 2's gate simulation
# pacing-rerun.sh (its own script) runs Stage 3's pacing test under the rule, on the working tree.
# second-pass.sh (its own script, also on the working tree) is the second-pass check: the style band at every level, chain-pulls,
# the high trees and the Kilnglass variants.
# content.ts holds the proposal as data (R0 removed its Stage 3 and Stage 4 overlays: those stages are merged).
# fight.ts runs Stage 4's positional fight on the game's own rules, boss.ts reads Ashmantle from the game (see their headers).
# Usage, from the repository root, behind the memory cap: scripts/capped.sh bash docs/superpowers/research/content-model/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT
# The aggression rule patched into a copy of Stage 2's monster rules: two replacements, each must match exactly once.
node - "$root/src/state/monsterAi.ts" "$out/monsterAi.patched.ts" "$root" "$here" <<'JS'
const fs = require('fs');
const [src, dst, root, here] = process.argv.slice(2);
let s = fs.readFileSync(src, 'utf8');
const swap = (from, to) => { if (s.split(from).length !== 2) { console.error('run.sh: anchor not found exactly once: ' + from); process.exit(2); } s = s.replace(from, to); };
swap("    world.playerCombat != null &&\n    monsterThreatColor(m.level, world.playerCombat) !== 'green'\n", "    world.playerCombat != null\n");
swap("const aggroRadius = camp.aggroRadius ?? (m.style === 'magic' || m.style === 'ranged' ? 12 : 9);",
  "const aggroRadius = sightRadius(camp.aggroRadius ?? (m.style === 'magic' || m.style === 'ranged' ? 12 : 9), m.level, world.playerCombat, KEEPS_SIGHT.includes(camp.id));");
s = s.replace(/from '\.\.\/data\//g, "from '" + root + "/src/data/").replace(/from '\.\//g, "from '" + root + "/src/state/");
s = "import { KEEPS_SIGHT, sightRadius } from '" + here + "/aggro';\n" + s;
fs.writeFileSync(dst, s);
JS
for name in model check aggro-check; do
  "$root/node_modules/.bin/esbuild" "$here/$name.ts" --bundle --platform=node --format=esm --log-level=warning \
    --alias:@patched/monsterAi="$out/monsterAi.patched.ts" --outfile="$out/$name.mjs"
done
run() {
  env -i HOME="$HOME" PATH="$PATH" node --max-old-space-size=1024 "$out/$1.mjs"
}
status=0
run model | tee "$here/results.txt" || status=1
run check | tee "$here/check-results.txt" || status=1
run aggro-check | tee "$here/aggro-results.txt" || status=1
exit $status
