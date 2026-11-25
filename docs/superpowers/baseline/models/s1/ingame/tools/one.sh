#!/bin/bash
# usage: one.sh <build>
MP=/home/rdrosa/gitprojects/allan/osrs-like-wp/MP
B=$1; W=$MP/scratch/s3wt-$B
cd $MP
git worktree add --detach $W HEAD >/dev/null 2>&1 || exit 1
cp -al node_modules $W/node_modules
cd $W
git apply $MP/scratch/s3/debug.patch || exit 1
cp $MP/scratch/models-build/s2final/$B/monsters.glb public/models/monsters.glb
cp $MP/tests/fixtures/model-contract/pending/monsters.json tests/fixtures/model-contract/monsters.json
$MP/scripts/capped.sh npm run build 2>&1 | tail -2
cp $MP/scratch/s3/clips/clips.glb dist/clips.glb
JOB=${JOB} OUT=${OUTDIR:-$MP/scratch/s3/out}/$B LABEL=$B STEPS=${STEPS:-perf,cost,poses,close,leak,clips} $MP/scratch/s3/run.sh $W 2>&1 | tail -2 | cut -c1-3000
cd $MP
git worktree remove --force $W
git worktree prune
ls $MP/scratch | grep s3wt
