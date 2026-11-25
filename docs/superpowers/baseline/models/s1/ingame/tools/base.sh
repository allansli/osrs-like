#!/bin/bash
MP=/home/rdrosa/gitprojects/allan/osrs-like-wp/MP
W=$MP/scratch/s3wt-base
cd $MP; git worktree add --detach $W HEAD >/dev/null 2>&1 || exit 1
cp -al node_modules $W/node_modules; cd $W
git apply $MP/scratch/s3/debug.patch || exit 1
$MP/scripts/capped.sh npm run build 2>&1 | tail -1
JOB=${JOB} OUT=${OUTDIR:-$MP/scratch/s3/out}/base LABEL=base STEPS=${STEPS} $MP/scratch/s3/run.sh $W 2>&1 | tail -1 | cut -c1-2500
cd $MP; git worktree remove --force $W; git worktree prune
