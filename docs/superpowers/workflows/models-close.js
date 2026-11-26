export const meta = {
  name: 'models-close',
  description: 'Models pass close: X2 final budgets, X3 final check (agent part). Opus verify each. No push.',
  phases: [{ title: 'Lanes', detail: 'X2 then X3' }],
}
const PLAN = 'docs/superpowers/plans/2026-11-14-models-pass-plan.md'
const DESIGN = 'docs/superpowers/specs/2026-11-14-models-pass-design.md'
const LOGS = '/tmp/claude-1000/-home-rdrosa-gitprojects-allan-osrs-like/49c111c4-413d-4c3a-9eed-67685c0d7161/scratchpad/agy'
const ROOT = '/home/rdrosa/gitprojects/allan/osrs-like-wp'
const LANES = [
  { name: 'main', tasks: [
    { id: 'X2', kind: 'work', model: 'sonnet', part: 'task X2 in full. If a ceiling does not hold, do not raise it and do not change any GLB: stop, leave that ceiling at the design value with the test red, and list each miss with its numbers in the summary and in docs/superpowers/baseline/models/budgets.md (new) so the main session can take it to the owner' },
    { id: 'X3', kind: 'work', model: 'opus', part: 'the agent part of task X3: SG, P5 repeated, the sheets and captures indexed, Stage 5 start-pose draw calls, triangles and the leak check re-captured against its budget (GR7 numbers and the M0p misses carried to Slice 8 included), the design section 10 hand-off list, and README model and credits lines. The [HUMAN] items (curl sizes from the preview deployment, the owner playing ten minutes) and OM-F are written in final.md as open owner checks, not done' },
  ] },
]
const RUN_SCHEMA = { type: 'object', properties: { head_before: { type: 'string' }, head_after: { type: 'string' }, agy_exit: { type: 'string' }, status_short: { type: 'string' }, log_tail: { type: 'string' } }, required: ['head_before', 'head_after', 'agy_exit', 'status_short'] }
const WORK_SCHEMA = { type: 'object', properties: { head_before: { type: 'string' }, head_after: { type: 'string' }, summary: { type: 'string' } }, required: ['head_before', 'head_after', 'summary'] }
const VERDICT_SCHEMA = { type: 'object', properties: { pass: { type: 'boolean' }, defects: { type: 'array', items: { type: 'string' } }, gate: { type: 'string' }, notes: { type: 'string' } }, required: ['pass', 'defects', 'gate'] }
const GATE = 'Gate commands, always from the worktree root and always behind the machine-wide lock: `flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run` (SUITE), `flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run <file>` (ONE), `flock /tmp/claude-capped.lock scripts/capped.sh npx tsc --noEmit` (TYPES), `flock /tmp/claude-capped.lock scripts/capped.sh npm run build` (BUILD). Every Blender command (the plan\'s BLEND and SHEETS lines) runs as `flock /tmp/claude-blender.lock <the plan\'s line>`. Never run npm install or npm ci.'
const DECISIONS = 'The models-pass design and plan were approved by the owner; amendments and review-log entries at the end of both win over older text. Done, verified and merged into feat/models-pass: slices 0 to 3 (hero and gear promoted, guards rebuilt), slices 4 to 7 (every monster promoted, last at M4c, monsters 11081170) and X0 (the rigid monster path removed); SUITE fully green. Read the plan sections at the end (D2b and D3 amendments above all). The owner checks OM-S4 to OM-S7 after the merge; do not wait for them. The owner answered OM-P on 2026-11-25: route (a), three families, the pilot pattern in docs/superpowers/baseline/models/README.md. The owner art words: the models must make sense; old school but with good definition; that retro-gaming view with the technology we can ship today. N-3 (8-bit build step) was approved; N-6 (Hurt) is left out. Nothing is promoted in this run: these tasks never write public/models or blender/ or any GLB. One Blender process and one capped run at a time machine-wide (the locks below). Never leave a server running.'
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
