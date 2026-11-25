#!/bin/bash
# usage: one.sh <build|base>
MP=/home/rdrosa/gitprojects/allan/osrs-like-wp/MP
B=$1; W=$MP/scratch/s3wt-$B
cd $MP
git worktree add --detach $W HEAD >/dev/null 2>&1 || exit 1
cp -al node_modules $W/node_modules
cd $W
git apply $MP/scratch/s3c/debug.patch || exit 1
# S3c: a look-at offset for the body close-up (the camera's min distance 3.6 and the 1.85 look height frame a 1.3 tall goblin at its feet)
sed -i 's|const camTargetY = Math.max(terrainUnderCam + 1.2, player.pos.y + 1.85 + vertDist);|const camTargetY = Math.max(terrainUnderCam + 0.3, player.pos.y + 1.85 + vertDist + ((window as any).__lookDy ?? 0));|; s|_lookTargetVec.set(player.pos.x, player.pos.y + 1.85, player.pos.z);|_lookTargetVec.set(player.pos.x, player.pos.y + 1.85 + ((window as any).__lookDy ?? 0), player.pos.z);|' src/engine/loop.ts
grep -c __lookDy src/engine/loop.ts
if [ "$B" != base ]; then
  cp $MP/scratch/models-build/s3b/$B/monsters.glb public/models/monsters.glb
  M=monsters.json; case $B in a1|b1) M=monsters.one-material.json;; esac
  cp $MP/tests/fixtures/model-contract/pending/$M tests/fixtures/model-contract/monsters.json
fi
$MP/scripts/capped.sh npm run build 2>&1 | tail -2
cp $MP/scratch/s3c/clips/clips.glb dist/clips.glb
OUT=${OUTDIR:-$MP/scratch/s3c/out}/$B LABEL=$B STEPS=${STEPS} $MP/scratch/s3c/run.sh $W 2>&1 | tail -2 | cut -c1-600
cd $MP
git worktree remove --force $W
git worktree prune
ls $MP/scratch | grep s3wt
echo "$B finished"
