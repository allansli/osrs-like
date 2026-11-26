#!/bin/bash
cd /home/rdrosa/gitprojects/allan/osrs-like-wp/MP/scratch/s3d
for b in "$@"; do
  if [ $b = base ]; then S=poses,close,dist,shadow,body; else S=perf,cost,poses,close,dist,shadow,cull,sphere,leak,clips,body; fi
  STEPS=$S ./one.sh $b > log-$b.txt 2>&1
  echo "$b done $(date +%T)" >> all.status
done
echo ALLDONE >> all.status
