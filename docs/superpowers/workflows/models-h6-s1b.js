export const meta = {
  name: 'models-h6-s1b',
  description: 'Models pass: H6, H6b (vertex colour) then S0, S1b (skinned path) in order on feat/models-pass. No push, no merge.',
  phases: [{ title: 'Lanes', detail: 'H6, H6b, S0, S1b: implement, opus verify, repair' }],
}
const MAIN = '/home/rdrosa/gitprojects/allan/osrs-like-wp/MP'
const PLAN = 'docs/superpowers/plans/2026-11-14-models-pass-plan.md'
const DESIGN = 'docs/superpowers/specs/2026-11-14-models-pass-design.md'
const LOGS = '/tmp/claude-1000/-home-rdrosa-gitprojects-allan-osrs-like/49c111c4-413d-4c3a-9eed-67685c0d7161/scratchpad/agy'
const LANE = { c: 'engine', dir: MAIN, tasks: [
  { id: 'H6', kind: 'test' }, { id: 'H6b', kind: 'agy' },
  { id: 'S0', kind: 'test' }, { id: 'S1b', kind: 'agy' },
] }
const RUN_SCHEMA = { type: 'object', properties: { head_before: { type: 'string' }, head_after: { type: 'string' }, agy_exit: { type: 'string' }, status_short: { type: 'string' }, log_tail: { type: 'string' } }, required: ['head_before', 'head_after', 'agy_exit', 'status_short'] }
const WORK_SCHEMA = { type: 'object', properties: { head_before: { type: 'string' }, head_after: { type: 'string' }, summary: { type: 'string' } }, required: ['head_before', 'head_after', 'summary'] }
const VERDICT_SCHEMA = { type: 'object', properties: { pass: { type: 'boolean' }, defects: { type: 'array', items: { type: 'string' } }, gate: { type: 'string' }, notes: { type: 'string' } }, required: ['pass', 'defects', 'gate'] }
const GATE = 'Gate commands, always through the wrapper from the worktree root: `scripts/capped.sh npx vitest run` (SUITE), `scripts/capped.sh npx vitest run <file>` (ONE), `scripts/capped.sh npx tsc --noEmit` (TYPES), `scripts/capped.sh npm run build` (BUILD). Never run them without the wrapper and never two at once. Never run npm install or npm ci.'
const DECISIONS = `Stages 1 to 5 are merged to main and merged into this branch (0a1d0dc). The models-pass design and plan were approved by the owner on 2026-11-14, and R0 amended both on 2026-11-25 (af33a11): where R0's review log or an amendment differs from older text, the amendment wins. Done and verified: R0, P1 to P5, V1 to V4, F1, S1. OM-1 (the owner's art-direction check) is pending, and nothing in these tasks depends on it. Blender is not needed by these tasks; if a task's test helper needs a GLB fixture, the test writes it itself as the plan says. Test commands run in a memory-capped container through scripts/capped.sh, and node_modules is a real directory. Never leave a server running.`
const CONTEXT = `Work in ${MAIN} on branch feat/models-pass, directly on that branch, and never touch another directory. Tasks run strictly in this order: H6, H6b, S0, S1b; every task before this one is complete. ${DECISIONS}`
function agyRunPrompt(id) {
  const log = `${LOGS}/models-${id}.log`
  const agyPrompt = `Read the implementation plan at ${PLAN}. Read section 0 (conventions and rules) and then implement ONLY task ${id}, exactly as written, editing only the files that task lists. The design it refers to is ${DESIGN}. Work only in the current directory. The tasks it depends on are complete. Amendments and review-log entries at the end of the plan win over older text. Do not add defaulting fallbacks or null guards the task does not ask for. Make the git commits the task calls for (message format in plan section 0.3), with no attribution trailer of any kind. Do not push. Run the checks through scripts/capped.sh as in: scripts/capped.sh npx vitest run ; scripts/capped.sh npx tsc --noEmit ; scripts/capped.sh npm run build. Never run npm install or npm ci. When done, list the files you changed and the checks you ran.`
  return `Run these steps exactly and return the fields. Do not edit any file yourself and do not fix anything.
1. \`cd ${MAIN} && git rev-parse HEAD\` -> head_before.
2. Start in the background: \`cd ${MAIN} && rm -f ${log}.exit && (agy -p "${agyPrompt}" > ${log} 2>&1; echo $? > ${log}.exit) &\`
3. Wait until the file ${log}.exit exists. Poll with: \`for i in $(seq 1 100); do [ -f ${log}.exit ] && break; sleep 5; done; cat ${log}.exit 2>/dev/null || echo WAITING\`. Repeat that command while it prints WAITING, for at most 45 minutes in total. If it never appears, set agy_exit to "timeout".
4. \`cat ${log}.exit\` -> agy_exit. \`cd ${MAIN} && git rev-parse HEAD\` -> head_after. \`cd ${MAIN} && git status --short\` -> status_short. \`tail -c 1500 ${log}\` -> log_tail.`
}
function workPrompt(id) {
  return `You are implementing one task of an approved plan. ${CONTEXT}
Read ${PLAN}: section 0 (conventions, all rules), task ${id} in full and the review-log amendments at the end, plus the parts of ${DESIGN} it cites. Write exactly what task ${id} asks: new test files (and fixtures) only, in the files it lists. Read the source the tests exercise before writing them. Follow the plan's rule for the allowed red window of a test-first task.
Existing test files are frozen. ${GATE}
Run the task's Accept check for real. Commit in the plan's message format, with no attribution trailer. Do not push, merge or tag.
Return head_before (git rev-parse HEAD before your work), head_after, and a short summary with the real output of the Accept check.`
}
function verifyPrompt(id, headBefore, round) {
  return `Verify one task of an approved plan. You are the independent check: change nothing, fix nothing, commit nothing. ${CONTEXT}
Read ${PLAN} (section 0, task ${id} in full, and the review-log amendments at the end) and what it cites in ${DESIGN}. The work for task ${id} is the commits after ${headBefore} up to HEAD, plus anything uncommitted. This is verification round ${round}.
Check, with evidence from commands you run yourself (the implementer's report is not evidence):
1. Scope: every changed file is on the task's allowlist, and the working tree is clean.
2. Frozen tests: \`git diff origin/main --stat -- tests src/__tests__\` shows only files added on this branch, plus the replacements the plan declares. No other assertion was weakened or removed.
3. Commit messages follow the plan's rule, and no commit carries an AI or tool attribution trailer.
4. The task's Change was done completely and correctly, and its Must-not-change holds. Read the code, not the names. Look for any added defaulting fallback or null guard the task does not ask for, any explicit \`any\`, and any @ts-nocheck or @ts-ignore. For S1b, also read the shader text against design 6.1.3 and R0 item 10.
5. The task's Accept checks, run for real. ${GATE} For a test-first task, list what is red and why it is allowed. Otherwise the full gate must pass, except failures that a still-open test-first window allows. While S1b is not done, S0's tests may be red.

Return pass=true only if nothing needs fixing. Otherwise list each defect as one concrete, actionable sentence. Put the real gate result in gate.`
}
function repairPrompt(id, headBefore, defects) {
  return `Repair one task of an approved plan. ${CONTEXT}
Read ${PLAN}: section 0, task ${id} in full and the amendments at the end, and what it cites in ${DESIGN}. The task's work so far is the commits after ${headBefore} plus any uncommitted change. It failed verification, and you now own the task.
Fix all of these defects:
${defects.map((d, i) => `${i + 1}. ${d}`).join('\n')}

Rules:
- Stay inside the task's file allowlist.
- If a defect says the task was not done, implement it as the plan writes it.
- Never weaken or delete an assertion to get green.
- Add new commits in the plan's message format, with no attribution trailer. Do not push, merge or tag.

${GATE}
Run the task's Accept checks for real. Return head_before = ${headBefore}, head_after, and a summary that records this was a repair, what you changed, and the real check output.`
}
phase('Lanes')
const done = []
let stopped = null
for (const t of LANE.tasks) {
  let headBefore
  if (t.kind === 'agy') {
    const r = await agent(agyRunPrompt(t.id), { label: `${t.id}:agy-run`, phase: 'Lanes', model: 'haiku', effort: 'low', schema: RUN_SCHEMA })
    if (!r) { stopped = { at: t.id, reason: 'agy runner returned nothing' }; break }
    headBefore = r.head_before
    log(`${t.id}: agy exit ${r.agy_exit}, head ${r.head_before.slice(0, 7)} -> ${r.head_after.slice(0, 7)}`)
    if (r.head_before === r.head_after && !r.status_short.trim()) {
      const s = await agent(`You are implementing one task of an approved plan, because the agy backend produced nothing. ${CONTEXT}
Read ${PLAN}: section 0, task ${t.id} in full and the amendments at the end, and what it cites in ${DESIGN}. Implement task ${t.id} exactly, touching only the files it lists. ${GATE}
Commit in the plan's format, with no trailer. Record in the summary that you implemented it because agy failed. Return head_before, head_after and summary.`, { label: `${t.id}:sonnet-fallback`, phase: 'Lanes', model: 'sonnet', schema: WORK_SCHEMA })
      if (!s) { stopped = { at: t.id, reason: 'fallback returned nothing' }; break }
    }
  } else {
    const r = await agent(workPrompt(t.id), { label: `${t.id}:tests`, phase: 'Lanes', model: 'sonnet', schema: WORK_SCHEMA })
    if (!r) { stopped = { at: t.id, reason: 'test writer returned nothing' }; break }
    headBefore = r.head_before
  }
  let verdict = null
  for (let round = 1; round <= 4; round++) {
    verdict = await agent(verifyPrompt(t.id, headBefore, round), { label: `${t.id}:verify-${round}`, phase: 'Lanes', model: 'opus', schema: VERDICT_SCHEMA })
    if (!verdict) break
    if (verdict.pass || round === 4) break
    log(`${t.id}: verify round ${round} found ${verdict.defects.length} defect(s)`)
    await agent(repairPrompt(t.id, headBefore, verdict.defects), { label: `${t.id}:repair-${round}`, phase: 'Lanes', model: round >= 3 ? 'opus' : 'sonnet', schema: WORK_SCHEMA })
  }
  if (!verdict) { stopped = { at: t.id, reason: 'verifier returned nothing' }; break }
  done.push({ id: t.id, pass: verdict.pass, gate: verdict.gate, defects: verdict.pass ? [] : verdict.defects, notes: verdict.notes })
  if (!verdict.pass) { stopped = { at: t.id, reason: 'still failing after 4 rounds' }; break }
  log(`${t.id}: verified`)
}
return { done, stopped }
