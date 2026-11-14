export const meta = {
  name: 'stage2-phase3',
  description: 'Stage 2 phase 3: A7 gate simulation on the stage branch, then G-3 and an adversarial review of the whole stage diff. No push, no merge.',
  phases: [
    { title: 'Lanes', detail: 'A7: implement, opus verify, repair' },
    { title: 'Review', detail: 'G-3 verification and three review lenses, each finding checked by a skeptic' },
  ],
}

const MAIN = '/home/rdrosa/gitprojects/allan/osrs-like'
const WT = '/home/rdrosa/gitprojects/allan/osrs-like-wp'
const PLAN = 'docs/superpowers/plans/2026-11-13-world-foundation-plan.md'
const DESIGN = 'docs/superpowers/specs/2026-11-13-world-foundation-design.md'
const LOGS = '/tmp/claude-1000/-home-rdrosa-gitprojects-allan-osrs-like/49c111c4-413d-4c3a-9eed-67685c0d7161/scratchpad/agy'

const F = { c: 'F', dir: MAIN, tasks: [{ id: 'A7', kind: 'claude' }] }

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

const DECISIONS = `Stage 1 is complete and merged to main. Owner decision O-10 is made: CALL-6 to CALL-10, CALL-15, Q4 and Q7 are approved as written, with no amendment. Where the plan cites commit 1284a6e for line numbers, the same code now lives in the modules under src/engine and src/state.`
const CONTEXT = (l) => l.c === 'F'
  ? `Work in ${MAIN} on branch feat/world-place, directly on the stage branch. Every other Stage 2 task (W1-W8, A1-A6, B1-B3) is complete and merged here. ${DECISIONS}`
  : `This cluster runs in its own git worktree ${l.dir} on branch wp/${l.c}, which holds the stage branch feat/world-place with phase 1 merged (W1, A1-A4, B1-B2; lane W also has W2). Work only inside ${l.dir}; never touch ${MAIN} or another worktree. Every task this one depends on is complete, except that lane W and lane A run at the same time: lane W must not wait for A5-A6 and lane A must not wait for W3-W8. Other lanes run at the same time in other worktrees: stay strictly inside this task's file allowlist. ${DECISIONS}`

function agyRunPrompt(l, id) {
  const log = `${LOGS}/${id}.log`
  const dir = l.dir
  const agyPrompt = `Read the implementation plan at ${PLAN}. Read section 0 (conventions and rules) and then implement ONLY task ${id}, exactly as written, editing only the files that task lists. The design it refers to is ${DESIGN}. Work only in the current directory. The tasks it depends on are complete. Stage 1 is complete. Owner decision O-10 is made: every Stage 2 CALL is approved as written. Where the plan cites commit 1284a6e for line numbers, the same code now lives in the modules under src/engine and src/state. Do not add defaulting fallbacks or null guards the task does not ask for. Make the git commits the task calls for (message format in rule 0.3.8), with no attribution trailer of any kind. Do not push. Run the checks through scripts/capped.sh as in: scripts/capped.sh npx vitest run ; scripts/capped.sh npx tsc --noEmit ; scripts/capped.sh npm run build. When done, list the files you changed and the checks you ran.`
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
2. Frozen tests: \`git diff --stat main -- tests src/__tests__\` shows only added files, except a test file this task's plan text explicitly lists as edited (the three planned replacements of W3, W5 and A5); no assertion weakened or removed.
3. Commit messages follow rule 0.3.8; no commit carries an AI or tool attribution trailer (\`git log --format=%B ${headBefore}..HEAD\`).
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
      const r = await agent(agyRunPrompt(lane, t.id), { label: `${t.id}:agy-run`, phase: 'Lanes', model: 'haiku', effort: 'low', schema: RUN_SCHEMA })
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
const a7 = await runLane(F)
if (a7.stopped_at) return { a7, review: null }

phase('Review')
const FINDINGS = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: {
  title: { type: 'string' }, severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
  file: { type: 'string' }, line: { type: 'number' }, evidence: { type: 'string' }, scenario: { type: 'string' }, fix: { type: 'string' },
}, required: ['title', 'severity', 'file', 'evidence', 'scenario', 'fix'] } } }, required: ['findings'] }
const CHECK = { type: 'object', properties: { real: { type: 'boolean' }, severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }, reason: { type: 'string' } }, required: ['real', 'severity', 'reason'] }
const BASE = `You review Stage 2 ("world as a place") of a browser game in ${MAIN}, branch feat/world-place. The stage is every commit in \`git log main..HEAD\`; read the diff with \`git diff main...HEAD\` (skip docs/). The design is ${DESIGN} (section 6 and the goals G2.1-G2.9) and the plan is ${PLAN} (Stage 2 part). ${DECISIONS} Change nothing, commit nothing. ${GATE} Report only defects you can show with evidence from the code or from a command you ran: file, line, the concrete situation in which it goes wrong, and the fix. Do not report style. Rank each critical, high, medium or low.`
const LENSES = [
  { key: 'rules', prompt: `${BASE}\nLens: game rules against the design. Territory, aggression by level, the 3-second grace, safe zones, leashing and the return state (immunity, heal on arrival, stall give-up), the teleport rule, the monster hit roll, click-to-move on routes (re-pathing, stop distances, unreachable targets, cost per frame), and whether anything a player can do breaks a rule or gets a monster or the hero stuck. Known points to judge, not to repeat blindly: a returning monster blocked by a wall stays immune; when a monster target becomes unreachable the player re-runs a failing route search every frame.` },
  { key: 'world', prompt: `${BASE}\nLens: world data and terrain. Relief, paths, the ridge and its single pass, basins and water, walkability and collision, camps and their members, moved resource nodes and fishing spots, points of interest, signposts, the minimap, the terrain mesh, and whether every place stays reachable and nothing floats, is buried or blocks a station. Check the README world table against src/data/worldMap.ts.` },
  { key: 'saves-tests', prompt: `${BASE}\nLens: existing saves and test integrity. A version-4 save (localStorage gielinor_hero_save_v1) must load unchanged in meaning: positions that are now inside the ridge or a basin, saved targets, the renamed player.targetPos to player.waypoints, shrines and the teleport rule. Then the tests: \`git diff main...HEAD -- tests\` may change existing tests only by the three planned replacements (tests/terrain.test.ts with its golden fixture, tests/placements.test.ts, tests/monster-ai.test.ts) plus the removal of the fishing-spot exceptions; flag any weakened or removed assertion, any test that passes vacuously, and any goal G2.1-G2.9 without a real proof.` },
]
const g3 = agent(`Carry out task G-3 of ${PLAN} exactly, in ${MAIN} on branch feat/world-place. It is read-only: change nothing. ${GATE} For check 1, the allowed test edits are the three planned replacements plus the removal of the fishing-spot exceptions in tests/pathfind.test.ts and tests/placements.test.ts. Return the written report: each of the seven checks with pass or fail and the real evidence.`, { label: 'G-3', phase: 'Review', model: 'opus' })
const reviewed = await pipeline(LENSES,
  l => slot(() => agent(l.prompt, { label: `review:${l.key}`, phase: 'Review', model: 'opus', schema: FINDINGS })),
  (r, l) => parallel(((r && r.findings) || []).map(f => () => slot(() =>
    agent(`Try to refute this review finding about ${MAIN} (branch feat/world-place). Read the code yourself; change nothing. Finding: ${f.title}. File: ${f.file}${f.line ? ':' + f.line : ''}. Evidence given: ${f.evidence}. Scenario given: ${f.scenario}. Claimed severity: ${f.severity}. Decide whether it is real (the scenario can happen and has the stated effect) and what the right severity is. If you cannot confirm it from the code, real=false.`, { label: `check:${l.key}`, phase: 'Review', model: 'opus', schema: CHECK })
      .then(v => ({ ...f, lens: l.key, check: v }))))))
const findings = reviewed.flat().filter(Boolean)
return { a7, g3: await g3, confirmed: findings.filter(f => f.check && f.check.real), rejected: findings.filter(f => !f.check || !f.check.real).map(f => ({ title: f.title, reason: f.check && f.check.reason })) }
