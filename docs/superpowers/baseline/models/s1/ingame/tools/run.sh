#!/bin/bash
# usage: run.sh <worktree> ; env OUT LABEL STEPS pass through
MP=/home/rdrosa/gitprojects/allan/osrs-like-wp/MP
cd "$1"
$MP/node_modules/.bin/vite preview --port 4191 --strictPort > $MP/scratch/s3/prev.log 2>&1 &
P=$!
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:4191/ && break; sleep 0.5; done
cd $MP
timeout 500 node scripts/capture-gpu.mjs $MP/scratch/s3/${JOB:-job.mjs} http://localhost:4191/
RC=$?
kill $P; wait $P 2>/dev/null; ss -ltnp | grep -q ":4191 " && echo "PREVIEW STILL UP"
exit $RC
