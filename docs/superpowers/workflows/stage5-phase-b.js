export const meta = {
  name: 'stage5-phase-b',
  description: 'Stage 5 phase B: the spine runs air, ground, water, weather and effects (AR1-FX2) in order while the interface lane does the script policy (UI8a, UI8b). No push, no merge.',
  phases: [
    { title: 'Lanes', detail: 'spine AR1-FX2; UI lane UI8a, UI8b: implement, opus verify, repair' },
  ],
}

const MAIN = '/home/rdrosa/gitprojects/allan/osrs-like-wp/V5'
const SIDE = '/home/rdrosa/gitprojects/allan/osrs-like-vp/UI'
const WT = '/home/rdrosa/gitprojects/allan/osrs-like-wp'
const PLAN = 'docs/superpowers/plans/2026-11-14-visual-pass-plan.md'
const DESIGN = 'docs/superpowers/specs/2026-11-14-visual-pass-design.md'
const LOGS = '/tmp/claude-1000/-home-rdrosa-gitprojects-allan-osrs-like/49c111c4-413d-4c3a-9eed-67685c0d7161/scratchpad/agy'

const LANES = [
  { c: 'spine', dir: MAIN, tasks: [
    { id: 'AR1', kind: 'test' }, { id: 'AR2', kind: 'claude' }, { id: 'AR3', kind: 'agy' },
    { id: 'AR4a', kind: 'agy' }, { id: 'AR4b', kind: 'agy' },
    { id: 'GR1', kind: 'test' }, { id: 'GR2', kind: 'agy' }, { id: 'TR1', kind: 'test', model: 'opus' },
    { id: 'TR2', kind: 'agy' }, { id: 'GR3', kind: 'test', model: 'opus' }, { id: 'GR4', kind: 'agy' },
    { id: 'GR5', kind: 'agy' }, { id: 'GR6', kind: 'claude' }, { id: 'GR7', kind: 'claude' },
    { id: 'WT1', kind: 'test' }, { id: 'WT2', kind: 'agy' }, { id: 'WT3', kind: 'agy' },
    { id: 'WX1', kind: 'test' }, { id: 'WX2', kind: 'agy' }, { id: 'WX3', kind: 'agy' }, { id: 'WX4', kind: 'agy' },
    { id: 'FX1', kind: 'test' }, { id: 'FX2', kind: 'agy' },
  ] },
  { c: 'side', dir: SIDE, tasks: [
    { id: 'UI8a', kind: 'test' }, { id: 'UI8b', kind: 'agy' },
  ] },
]

const RUN_SCHEMA = { type: 'object', properties: {
  head_before: { type: 'string' }, head_after: { type: 'string' }, agy_exit: { type: 'string' },
  status_short: { type: 'string' }, log_tail: { type: 'string' },
}, required: ['head_before', 'head_after', 'agy_exit', 'status_short'] }
const WORK_SCHEMA = { type: 'object', properties: {
  head_before: { type: 'string' }, head_after: { type: 'string' }, summary: { type: 'string' },
}, required: ['head_before', 'head_after', 'summary'] }
const VERDICT_SCHEMA = { type: 'object', properties: {
  pass: { type: 'boolean' }, defects: { type: 'array', items: { type: 'string' } },
  gate: { type: 'string' }, notes: { type: 'string' },
}, required: ['pass', 'defects', 'gate'] }

const GATE = 'Gate commands, always through the wrapper from the worktree root: `scripts/capped.sh npx vitest run` (SUITE), `scripts/capped.sh npx vitest run <file>` (ONE), `scripts/capped.sh npx tsc --noEmit` (TYPES), `scripts/capped.sh npm run build` (BUILD). Never run them without the wrapper and never two at once.'

const DECISIONS = `Stages 1 to 4 are merged to main. Stage 5 is approved by the owner: read the notes at the top of the design; where they differ from a section's text, the notes win. Every OV step is decided as the design records (the weather set and the effects lane as proposed; UI8 is done in this stage); OV-2 (the owner's frame-time measurement) has not happened and the section 10 budgets stay provisional. The owner authorized the pathfind golden regeneration in TR2 (note at the top of the design). The plan's review log A11 items 4 to 6 are applied as amendments in AR1, AR4b, TR1 and TR2 (commit d4fdc12). Owner checkpoints (CP-AR, CP-GR, CP-WT, CP-WX, CP-FX) are judged by the main session from the captures each slice's last task commits, under the owner's standing rule to merge on green; agents do not wait for them. Done and verified: R0 to V2, LT1 to LT7b (CP-LT accepted), UI1 to UI7 (CP-UI accepted with fix 4e42403), and vp/UI is merged into feat/visual-pass. scripts/capture-gpu.mjs renders on the NVIDIA GPU (\`node scripts/capture-gpu.mjs --check\` exits 0 when it works; \`node scripts/capture-gpu.mjs <job.mjs> <url>\` runs a job module's default export (page, browser) after opening the url; pass the preview url explicitly); captures use it and record the renderer. Test commands run in a memory-capped container through scripts/capped.sh; node_modules in each worktree is a real directory. Never leave a preview or http server running when the task ends.`
const CONTEXT = (l) => l.dir === SIDE
  ? `This task runs in the interface worktree ${SIDE} on the local branch vp/UI, fast-forwarded to the feat/visual-pass head d4fdc12. Work only inside ${SIDE}; never touch ${MAIN} or any other directory. The spine slices (air, ground, water, weather, effects) are being built at the same time in ${MAIN}: stay strictly inside this task's file allowlist (the UI lane's files in plan section 0.4). Tasks here run one after another. ${DECISIONS}`
  : `Work in ${MAIN} on branch feat/visual-pass, directly on that branch, and never touch another directory. Spine tasks run strictly in the plan's order, and every spine task before this one is complete. The interface lane (UI8a, UI8b) runs at the same time in another worktree and touches none of this task's files. ${DECISIONS}`

function agyRunPrompt(l, id) {
  const log = `${LOGS}/${id}.log`
  const dir = l.dir
  const agyPrompt = `Read the implementation plan at ${PLAN}. Read section 0 (conventions and rules) and then implement ONLY task ${id}, exactly as written, editing only the files that task lists. The design it refers to is ${DESIGN}. Work only in the current directory. The tasks it depends on are complete. Stages 1 to 4 are merged and Stage 5 is approved; the notes at the top of the design win over section text. Owner checkpoints are judged by the main session; do not wait for them. Do not add defaulting fallbacks or null guards the task does not ask for. Make the git commits the task calls for (message format in plan section 0.3), with no attribution trailer of any kind. Do not push. Run the checks through scripts/capped.sh as in: scripts/capped.sh npx vitest run ; scripts/capped.sh npx tsc --noEmit ; scripts/capped.sh npm run build. When done, list the files you changed and the checks you ran.`
  return `Run these steps exactly and return the fields. Do not edit any file yourself and do not fix anything.
1. \`cd ${dir} && git rev-parse HEAD\` -> head_before.
2. Start in the background: \`cd ${dir} && rm -f ${log}.exit && (agy -p "${agyPrompt}" > ${log} 2>&1; echo $? > ${log}.exit) &\`
3. Wait until the file ${log}.exit exists. Poll with: \`for i in $(seq 1 100); do [ -f ${log}.exit ] && break; sleep 5; done; cat ${log}.exit 2>/dev/null || echo WAITING\`. Repeat that command while it prints WAITING, for at most 45 minutes in total. If it never appears, set agy_exit to "timeout".
4. \`cat ${log}.exit\` -> agy_exit. \`cd ${dir} && git rev-parse HEAD\` -> head_after. \`cd ${dir} && git status --short\` -> status_short. \`tail -c 1500 ${log}\` -> log_tail.`
}

function workPrompt(l, id, kind) {
  const what = kind === 'test'
    ? `Write exactly what task ${id} asks: new test files (and fixtures) only, in the files it lists. Read the source the tests exercise before writing them. Follow rule 0.3.4 for the allowed red window.`
    : `Implement task ${id} exactly, touching only the files it lists.`
  return `You are implementing one task of an approved plan. ${CONTEXT(l)}
Read ${PLAN}: section 0 (conventions, all rules) and task ${id} in full, and the parts of ${DESIGN} it cites. ${what}
Existing test files are frozen, except the single edit a planned replacement in this task names. ${GATE}
Run the task's Accept check for real. Commit in the plan's message format, with no attribution trailer. Do not push, merge or tag.
Return head_before (git rev-parse HEAD in the worktree before your work), head_after, and a short summary with the real output of the Accept check.`
}

function verifyPrompt(l, id, headBefore, round) {
  return `Verify one task of an approved plan. You are the independent check: change nothing, fix nothing, commit nothing. ${CONTEXT(l)}
Read ${PLAN} (section 0 and task ${id} in full) and what it cites in ${DESIGN}. The work for task ${id} is the commits after ${headBefore} up to HEAD of ${l.dir}, plus anything uncommitted. This is verification round ${round}.
Check, with evidence from commands you run yourself in ${l.dir} (the implementer's report is not evidence):
1. Scope: every changed file is on the task's allowlist. The working tree is clean.
2. Frozen tests (plan rule 0.3.3): \`git diff origin/main --stat -- tests src/__tests__\` shows only added files, except the replacements the plan and design 9.3 declare with file and exact assertion; no other assertion weakened or removed.
3. Commit messages follow the plan's commit rule in section 0.3; no commit carries an AI or tool attribution trailer (\`git log --format=%B ${headBefore}..HEAD\`).
4. The task's "Change" was done completely and correctly, and its "Must not change" holds. Read the code and data; do not trust names. Check that no defaulting fallback (\`|| ''\`, \`?? 0\`) or null guard was added that the task does not ask for, no explicit \`any\` outside the three allowed seams, and no @ts-nocheck / @ts-ignore.
5. The task's "Accept" checks, run for real. ${GATE} For a test-first task apply rule 0.3.4 and list what is red and why it is allowed. Otherwise the full Standard Gate must pass, except failures a still-open test-first window of this same lane allows.
Return pass=true only if nothing needs fixing. Otherwise list each defect as one concrete, actionable sentence. Put the real gate result in gate.`
}

function repairPrompt(l, id, headBefore, defects) {
  return `Repair one task of an approved plan. ${CONTEXT(l)}
Read ${PLAN}: section 0 (all rules) and task ${id} in full, and what it cites in ${DESIGN}. The task's work so far is the commits after ${headBefore} in ${l.dir} plus any uncommitted change; it failed verification and you now own the task.
Defects to fix, all of them:
${defects.map((d, i) => `${i + 1}. ${d}`).join('\n')}
Stay inside the task's file allowlist. If a defect says the task was not done, implement it as the plan writes it. Never weaken or delete an assertion to get green. Add new commits in the plan's message format; no attribution trailer. Do not push, merge or tag. ${GATE}
Run the task's Accept checks for real. Return head_before = ${headBefore}, head_after, and a summary recording that this was a repair, what you changed, and the real check output.`
}

// at most three lanes at a time
let active = 0
const waiters = []
async function slot(fn) {
  while (active >= 3) await new Promise(r => waiters.push(r))
  active++
  try { return await fn() } finally { active--; const w = waiters.shift(); if (w) w() }
}

async function runLane(lane) {
  const done = []
  for (const t of lane.tasks) {
    let headBefore
    if (t.kind === 'agy') {
      const r = await agent(agyRunPrompt(lane, t.id), { label: `${t.id}:agy-run`, phase: lane.c === 'F' ? 'Prep' : 'Lanes', model: 'haiku', effort: 'low', schema: RUN_SCHEMA })
      if (!r) return { cluster: lane.c, stopped_at: t.id, reason: 'agy runner returned nothing', done }
      headBefore = r.head_before
      log(`${t.id}: agy exit ${r.agy_exit}`)
    } else {
      const r = await agent(workPrompt(lane, t.id, t.kind), { label: `${t.id}:${t.kind === 'test' ? 'tests' : 'implement'}`, phase: 'Lanes', model: t.model || (t.kind === 'test' ? 'sonnet' : 'opus'), schema: WORK_SCHEMA })
      if (!r) return { cluster: lane.c, stopped_at: t.id, reason: 'implementer returned nothing', done }
      headBefore = r.head_before
    }
    let verdict = null
    for (let round = 1; round <= 4; round++) {
      verdict = await agent(verifyPrompt(lane, t.id, headBefore, round), { label: `${t.id}:verify-${round}`, phase: 'Lanes', model: 'opus', schema: VERDICT_SCHEMA })
      if (!verdict) return { cluster: lane.c, stopped_at: t.id, reason: 'verifier returned nothing', done }
      if (verdict.pass || round === 4) break
      log(`${t.id}: verify round ${round} found ${verdict.defects.length} defect(s)`)
      await agent(repairPrompt(lane, t.id, headBefore, verdict.defects), { label: `${t.id}:repair-${round}`, phase: 'Lanes', model: t.kind === 'claude' || t.model === 'opus' || round >= 3 ? 'opus' : 'sonnet', schema: WORK_SCHEMA })
    }
    done.push({ id: t.id, pass: verdict.pass, gate: verdict.gate, defects: verdict.pass ? [] : verdict.defects, notes: verdict.notes })
    if (!verdict.pass) return { cluster: lane.c, stopped_at: t.id, reason: 'still failing after 4 verification rounds', done }
    log(`${t.id}: verified`)
  }
  return { cluster: lane.c, stopped_at: null, done }
}

phase('Lanes')
const results = await parallel(LANES.map(l => () => slot(() => runLane(l))))
return { lanes: results }
