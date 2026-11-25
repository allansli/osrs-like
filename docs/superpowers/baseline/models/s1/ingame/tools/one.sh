#!/bin/bash
# usage: one.sh <build|base>
MP=/home/rdrosa/gitprojects/allan/osrs-like-wp/MP
B=$1; W=$MP/scratch/s3wt-$B
cd $MP
git worktree add --detach $W HEAD >/dev/null 2>&1 || exit 1
cp -al node_modules $W/node_modules
cd $W
git apply $MP/scratch/s3b/debug.patch || exit 1
if [ "$B" != base ]; then
  cp $MP/scratch/models-build/s3b/$B/monsters.glb public/models/monsters.glb
  cp $MP/tests/fixtures/model-contract/pending/monsters.json tests/fixtures/model-contract/monsters.json
fi
$MP/scripts/capped.sh npm run build 2>&1 | tail -2
cp $MP/scratch/s3b/clips/clips.glb dist/clips.glb
OUT=${OUTDIR:-$MP/scratch/s3b/out}/$B LABEL=$B STEPS=${STEPS} $MP/scratch/s3b/run.sh $W 2>&1 | tail -2 | cut -c1-600
cd $MP
git worktree remove --force $W
git worktree prune
ls $MP/scratch | grep s3wt
echo "$B finished"
