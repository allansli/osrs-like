export const meta = {
  name: 'models-slices5-7',
  description: 'Models pass slices 5 to 7 and X0, serial on feat/models-pass: archer and chicken, scorpion, wizard and ranger, kits, giant and guardian, three promotes, rigid path removed. Opus verify each. No push.',
  phases: [{ title: 'Lanes', detail: 'M3a to X0, serial' }],
}
const PLAN = 'docs/superpowers/plans/2026-11-14-models-pass-plan.md'
const DESIGN = 'docs/superpowers/specs/2026-11-14-models-pass-design.md'
const LOGS = '/tmp/claude-1000/-home-rdrosa-gitprojects-allan-osrs-like/49c111c4-413d-4c3a-9eed-67685c0d7161/scratchpad/agy'
const ROOT = '/home/rdrosa/gitprojects/allan/osrs-like-wp'
const LANES = [
  { name: 'main', tasks: [
    { id: 'M3a', kind: 'work', model: 'opus', part: 'task M3a in full, with the goblin refinements the plan section Lanes 2 and promotes moves to it (chest-to-belly step, instep, toe box, thumb)' },
    { id: 'M4a', kind: 'work', model: 'sonnet', part: 'task M4a in full, the promote as M0p, H7 and D5 promoted (BLEND, COMPARE, public/models/monsters.glb and blender/monsters.blend, the 8-bit step, live manifest from pending with the same margins, ?v= key with tests/model-cache-key.test.ts, totals.json, follow-through test edits only as H7 and D5 declared them, any other one written as a plan amendment first), with its captures and sheets; the untouched figures show zero Drift' },
    { id: 'M3b', kind: 'work', model: 'opus', part: 'task M3b in full' },
    { id: 'M3e', kind: 'work', model: 'opus', part: 'task M3e in full' },
    { id: 'K1', kind: 'work', model: 'opus', part: 'task K1 in full' },
    { id: 'K2', kind: 'work', model: 'opus', part: 'task K2 in full' },
    { id: 'K3', kind: 'agy' },
    { id: 'K4', kind: 'work', model: 'sonnet', part: 'task K4 in full, the promote as M0p, H7 and D5 promoted (BLEND, COMPARE, public/models/monsters.glb and blender/monsters.blend, the 8-bit step, live manifest from pending with the same margins, ?v= key with tests/model-cache-key.test.ts, totals.json, follow-through test edits only as H7 and D5 declared them, any other one written as a plan amendment first), with its captures and sheets; the untouched figures show zero Drift; tests/monster-models.test.ts turns fully green' },
    { id: 'M3c', kind: 'work', model: 'opus', part: 'task M3c in full' },
    { id: 'M4c', kind: 'work', model: 'sonnet', part: 'task M4c in full, the promote as M0p, H7 and D5 promoted (BLEND, COMPARE, public/models/monsters.glb and blender/monsters.blend, the 8-bit step, live manifest from pending with the same margins, ?v= key with tests/model-cache-key.test.ts, totals.json, follow-through test edits only as H7 and D5 declared them, any other one written as a plan amendment first), with its captures and sheets; the untouched figures show zero Drift, and the roster silhouette sheet' },
    { id: 'X0', kind: 'agy' },
  ] },
]
const RUN_SCHEMA = { type: 'object', properties: { head_before: { type: 'string' }, head_after: { type: 'string' }, agy_exit: { type: 'string' }, status_short: { type: 'string' }, log_tail: { type: 'string' } }, required: ['head_before', 'head_after', 'agy_exit', 'status_short'] }
const WORK_SCHEMA = { type: 'object', properties: { head_before: { type: 'string' }, head_after: { type: 'string' }, summary: { type: 'string' } }, required: ['head_before', 'head_after', 'summary'] }
const VERDICT_SCHEMA = { type: 'object', properties: { pass: { type: 'boolean' }, defects: { type: 'array', items: { type: 'string' } }, gate: { type: 'string' }, notes: { type: 'string' } }, required: ['pass', 'defects', 'gate'] }
const GATE = 'Gate commands, always from the worktree root and always behind the machine-wide lock: `flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run` (SUITE), `flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run <file>` (ONE), `flock /tmp/claude-capped.lock scripts/capped.sh npx tsc --noEmit` (TYPES), `flock /tmp/claude-capped.lock scripts/capped.sh npm run build` (BUILD). Every Blender command (the plan\'s BLEND and SHEETS lines) runs as `flock /tmp/claude-blender.lock <the plan\'s line>`. Never run npm install or npm ci.'
const DECISIONS = 'The models-pass design and plan were approved by the owner; amendments and review-log entries at the end of both win over older text. Done, verified and merged into feat/models-pass: slices 0 to 3 (hero and gear promoted, guards rebuilt), and slice 4 (D5 promoted monsters ad6a47b7: the new dragon, Ashmantle on its own body, the rebuilt demon). Known red: tests/monster-models.test.ts "the two variant rows name their kits" (until K3). Read the plan sections at the end (D2b and D3 amendments above all). The owner checks OM-S4 to OM-S7 after the merge; do not wait for them. The owner answered OM-P on 2026-11-25: route (a), three families, the pilot pattern in docs/superpowers/baseline/models/README.md. The owner art words: the models must make sense; old school but with good definition; that retro-gaming view with the technology we can ship today. N-3 (8-bit build step) was approved; N-6 (Hurt) is left out. This run promotes public/models/monsters.glb and blender/monsters.blend at M4a, K4 and M4c only; every other task builds and compares and never writes public/models or blender/. One Blender process and one capped run at a time machine-wide (the locks below). Never leave a server running.'
function ctx(lane) { return `Work only in ${ROOT}/MP on branch feat/models-pass; never touch another directory or branch. ${DECISIONS}` }
function agyRun(lane, t) {
  const dir = `${ROOT}/MP`
  const log = `${LOGS}/lane-${lane.name}-${t.id}.log`
  const what = t.note || `task ${t.id}`
  const p = `Read the implementation plan at ${PLAN}. Read section 0 and then implement ONLY ${what}, exactly as written, editing only the files that task lists. The design is ${DESIGN}. Work only in the current directory. The tasks it depends on are complete. Amendments and review-log entries at the end of the plan win over older text. Do not add defaulting fallbacks or null guards the task does not ask for. Commit in the plan's format with no attribution trailer of any kind. Do not push. Run checks only as: flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run ; flock /tmp/claude-capped.lock scripts/capped.sh npx tsc --noEmit ; flock /tmp/claude-capped.lock scripts/capped.sh npm run build. Run Blender only as flock /tmp/claude-blender.lock followed by the plan's BLEND line. Never run npm install or npm ci. When done, list the files you changed and the checks you ran.`
  return `Run these steps exactly and return the fields. Do not edit any file yourself and do not fix anything.
1. \`cd ${dir} && git rev-parse HEAD\` -> head_before.
2. Start in the background: \`cd ${dir} && rm -f ${log}.exit && (agy -p "${p}" > ${log} 2>&1; echo $? > ${log}.exit) &\`
3. Wait until ${log}.exit exists: \`for i in $(seq 1 100); do [ -f ${log}.exit ] && break; sleep 5; done; cat ${log}.exit 2>/dev/null || echo WAITING\`. Repeat while it prints WAITING, at most 60 minutes in total; if it never appears set agy_exit to "timeout".
4. \`cat ${log}.exit\` -> agy_exit. \`cd ${dir} && git rev-parse HEAD\` -> head_after. \`cd ${dir} && git status --short\` -> status_short. \`tail -c 1500 ${log}\` -> log_tail.`
}
const work = (lane, id, part) => `You are implementing one task of an approved plan. ${ctx(lane)}
Read ${PLAN}: section 0 (all rules), task ${id} in full, and the amendment and review-log sections at the end, plus the parts of ${DESIGN} it cites and docs/superpowers/baseline/models/README.md (the pilot's pattern). Do ${part}, touching only the files it lists. Existing test files are frozen except declared replacements. ${GATE}
Run the task's Accept checks for real. Commit in the plan's format with no attribution trailer. Do not push, merge or tag.
Return head_before (git rev-parse HEAD before your work), head_after and a summary with the real check output.`
const verify = (lane, t, hb, round) => `Verify one task of an approved plan. You are the independent check: change nothing, fix nothing, commit nothing. ${ctx(lane)}
Read ${PLAN} (section 0, task ${t.id} in full, the amendments at the end) and what it cites in ${DESIGN}. The work is the commits after ${hb} up to HEAD in that worktree, plus anything uncommitted. This is round ${round}${t.kind === 'work' && t.part && t.part.includes('test-first') ? '; this step is only the test-first part, so its new tests may be red until the next step lands' : ''}.
Check with evidence from commands you run yourself: 1. scope: every changed file is on the task's list, tree clean; 2. frozen tests: \`git diff origin/main --diff-filter=MDR -- tests src/__tests__\` lists only declared replacements; 3. commit messages follow the plan and carry no AI or tool trailer; 4. the Change is complete and correct and Must-not-change holds; no added defaulting fallback or null guard, no explicit any, no ts-ignore or ts-nocheck; for an art task, open its committed sheets and judge them against design section 5, the pilot's pattern and the owner's art words; 5. the Accept checks, run for real. ${GATE}
Return pass=true only if nothing needs fixing; otherwise one concrete sentence per defect. Put the real gate result in gate.`
const repair = (lane, t, hb, defects) => `Repair one task of an approved plan. ${ctx(lane)}
Read ${PLAN}: section 0, task ${t.id} and the amendments at the end, and what it cites in ${DESIGN}. The work so far is the commits after ${hb}. It failed verification; fix all of these:
${defects.map((d, i) => `${i + 1}. ${d}`).join('\n')}
Stay inside the task's file list; never weaken or delete an assertion; new commits in the plan's format with no trailer; no push. ${GATE}
Return head_before = ${hb}, head_after and a summary that says this was a repair and gives the real check output.`
async function runLane(lane) {
  const done = []
  for (const t of lane.tasks) {
    const L = `${lane.name}:${t.id}`
    let hb
    if (t.kind === 'verify') {
      hb = t.hb
    } else if (t.kind === 'agy') {
      const r = await agent(agyRun(lane, t), { label: `${L}:agy`, phase: 'Lanes', model: 'haiku', effort: 'low', schema: RUN_SCHEMA })
      if (!r) return { lane: lane.name, done, stopped: `${t.id}: agy runner returned nothing` }
      hb = r.head_before
      log(`${L}: agy exit ${r.agy_exit}`)
      if (r.head_before === r.head_after && !r.status_short.trim()) {
        const s = await agent(work(lane, t.id, `${t.note || 'task ' + t.id}, because the agy backend produced nothing (say so in the summary)`), { label: `${L}:fallback`, phase: 'Lanes', model: 'sonnet', schema: WORK_SCHEMA })
        if (!s) return { lane: lane.name, done, stopped: `${t.id}: fallback returned nothing` }
      }
    } else {
      const r = await agent(work(lane, t.id, t.part), { label: `${L}:work`, phase: 'Lanes', model: t.model, schema: WORK_SCHEMA })
      if (!r) return { lane: lane.name, done, stopped: `${t.id}: worker returned nothing` }
      hb = r.head_before
    }
    let v = null
    for (let round = 1; round <= 4; round++) {
      v = await agent(verify(lane, t, hb, round), { label: `${L}:verify-${round}`, phase: 'Lanes', model: 'opus', schema: VERDICT_SCHEMA })
      if (!v || v.pass || round === 4) break
      log(`${L}: round ${round}, ${v.defects.length} defect(s)`)
      const rm = t.id === 'H3b' ? 'opus' : (t.kind === 'work' && (t.model === 'opus' || t.model === 'fable') ? t.model : (round >= 3 ? 'opus' : 'sonnet'))
      await agent(repair(lane, t, hb, v.defects), { label: `${L}:repair-${round}`, phase: 'Lanes', model: rm, schema: WORK_SCHEMA })
    }
    if (!v) return { lane: lane.name, done, stopped: `${t.id}: verifier returned nothing` }
    done.push({ id: t.id, pass: v.pass, gate: v.gate, defects: v.pass ? [] : v.defects, notes: (v.notes || '').slice(0, 1500) })
    if (!v.pass) return { lane: lane.name, done, stopped: `${t.id}: still failing after 4 rounds` }
    log(`${L}: verified`)
  }
  return { lane: lane.name, done, stopped: null }
}
phase('Lanes')
const results = await parallel(LANES.map((lane) => () => runLane(lane)))
return results
