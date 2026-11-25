#!/bin/bash
cd /home/rdrosa/gitprojects/allan/osrs-like-wp/MP
S=scratch/s3c
for b in a3 b3 a1 b1; do
  body=${b:0:1}; mats=${b:1:1}
  timeout 600 env BLENDER_PATH=/usr/bin/blender GOBLIN_BODY=$body GOBLIN_MATS=$mats node scripts/run-blender.mjs monsters --out scratch/models-build/s3b/$b > $S/build-$b.log 2>&1
  echo "$b build exit $?" >> $S/build.status
  G=scratch/models-build/s3b/$b/monsters.glb
  if [ $mats = 1 ]; then cp $G scratch/models-build/s3b/$b/monsters.one-material.glb; G=scratch/models-build/s3b/$b/monsters.one-material.glb; fi
  node scripts/models-compare.mjs $G public/models/monsters.glb > $S/cmp-$b.txt 2>&1
  echo "$b compare exit $?" >> $S/build.status
done
echo DONE >> $S/build.status
