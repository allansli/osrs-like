#!/bin/bash
cd /home/rdrosa/gitprojects/allan/osrs-like-wp/MP
env -i HOME="$HOME" PATH="$PATH" timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs monsters --out scratch/models-build/s3d > scratch/s3d/build.log 2>&1
echo "build exit $?" > scratch/s3d/build.status
node scripts/models-compare.mjs scratch/models-build/s3d/monsters.glb public/models/monsters.glb > scratch/s3d/cmp.txt 2>&1
echo "compare exit $?" >> scratch/s3d/build.status
