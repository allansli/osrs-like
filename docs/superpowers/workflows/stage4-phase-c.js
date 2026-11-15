export const meta = {
  name: 'stage4-phase-c',
  description: 'Stage 4 phase C: wiring W1-W4 on the stage branch, then G-7 and an adversarial review of the whole stage diff. No push, no merge.',
  phases: [
    { title: 'Lanes', detail: 'W1-W4: implement, opus verify, repair' },
    { title: 'Review', detail: 'G-7 verification and three review lenses, each finding checked by a skeptic' },
  ],
}

const MAIN = '/home/rdrosa/gitprojects/allan/osrs-like-wp/S4'
const WT = '/home/rdrosa/gitprojects/allan/osrs-like-wp'
const PLAN = 'docs/superpowers/plans/2026-11-14-combat-weight-plan.md'
const DESIGN = 'docs/superpowers/specs/2026-11-14-combat-weight-design.md'
const LOGS = '/tmp/claude-1000/-home-rdrosa-gitprojects-allan-osrs-like/49c111c4-413d-4c3a-9eed-67685c0d7161/scratchpad/agy'

const F = { c: 'spine', dir: MAIN, tasks: [
  { id: 'W1', kind: 'agy' }, { id: 'W2', kind: 'agy' }, { id: 'W3', kind: 'agy' }, { id: 'W4', kind: 'claude', model: 'sonnet' },
] }

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

const DECISIONS = `Stages 1, 2 and 3 are merged to main, and main is merged into feat/combat-weight. Stage 4 is approved by the owner: read the approval note at the top of the design; where it differs from a section's text, the note wins (the boss opens with a 2-second roar, a banner and the line that its bolts are magic; dying costs 3% of the current level's span in every fighting skill, with options a to d as recommended; names stay as written; regeneration is 0.25 HP/s in combat and 1.0 out). Every O-4.x owner step is done. Phases A and B are complete and merged on feat/combat-weight: R0, P1-P4, T1-T6, M1-M3, B1-B4, S1-S2, F1-F2, A1-A2. CP-4 passed after T6 (docs/superpowers/baseline/cw/README.md). Only lane W (W1-W4) remains, then the gate G-7. No side worktree is used in this phase.`
const CONTEXT = (l) => `Work in ${MAIN} on branch feat/combat-weight, directly on that branch, and never touch another directory. No other agent is editing it. Tasks run strictly in the plan's order, and every task before this one is complete. ${DECISIONS}`

function agyRunPrompt(l, id) {
  const log = `${LOGS}/${id}.log`
  const dir = l.dir
  const agyPrompt = `Read the implementation plan at ${PLAN}. Read section 0 (conventions and rules) and then implement ONLY task ${id}, exactly as written, editing only the files that task lists. The design it refers to is ${DESIGN}. Work only in the current directory. The tasks it depends on are complete. Stages 1 to 3 are merged and Stage 4 is approved; the approval note at the top of the design wins over section text. Do not add defaulting fallbacks or null guards the task does not ask for. Make the git commits the task calls for (message format in plan section 0.3), with no attribution trailer of any kind. Do not push. Run the checks through scripts/capped.sh as in: scripts/capped.sh npx vitest run ; scripts/capped.sh npx tsc --noEmit ; scripts/capped.sh npm run build. When done, list the files you changed and the checks you ran.`
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
const lane = await runLane(F)
if (lane.stopped_at) return { lane, review: null }

phase('Review')
const FINDINGS = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: {
  title: { type: 'string' }, severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
  file: { type: 'string' }, line: { type: 'number' }, evidence: { type: 'string' }, scenario: { type: 'string' }, fix: { type: 'string' },
}, required: ['title', 'severity', 'file', 'evidence', 'scenario', 'fix'] } } }, required: ['findings'] }
const CHECK = { type: 'object', properties: { real: { type: 'boolean' }, severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }, reason: { type: 'string' } }, required: ['real', 'severity', 'reason'] }
const BASE = `You review Stage 4 ("combat with weight") of a browser game in ${MAIN}, branch feat/combat-weight. The stage is every commit in \`git log origin/main..HEAD\`; read the diff with \`git diff origin/main...HEAD\` (skip docs/). The design is ${DESIGN} (read the approval note at its top; it wins over section text) and the plan is ${PLAN}. ${DECISIONS} Change nothing, commit nothing. ${GATE} Report only defects you can show with evidence from the code or from a command you ran: file, line, the concrete situation in which it goes wrong, and the fix. Do not report style. Rank each critical, high, medium or low.`
const LENSES = [
  { key: 'combat', prompt: `${BASE}\nLens: combat rules against the design. Monster routes (re-path budget, no-route cases, leash, return immunity and the home clock), telegraphed attacks (wind-up, resolve by position, cancel, one shape per camp, the heavy roll keeping average damage), the boss Ashmantle (phases and gates, arena rule, opening warning, respawn, reload mid-fight, the existing dragon untouched), auto-retaliation, the food cooldown and regeneration rates, the experience loss on death and the Lantern Vow (never drops a level, nothing at 99, small-loss waiver, purchase at the altar). Can a player exploit or be soft-locked by any of it?` },
  { key: 'feel', prompt: `${BASE}\nLens: feel and engine wiring. Hit reactions (hit stop, flinch, knock-back, camera, the spin fix of audit finding 14), the telegraph meshes (halo, band, fill, depth, disposal), sound (scheduling on the audio clock, mute, autoplay unlock, voice cap, cues on the right events), reduced motion, graphics tiers, performance per frame with 42 monsters, memory leaks on respawn and on many telegraphs, and the boss bar and banners in the HUD. Flag anything that breaks click-to-act or takes control from the player.` },
  { key: 'saves-tests', prompt: `${BASE}\nLens: existing saves and test integrity. A version-4 save (localStorage gielinor_hero_save_v1) must load and keep what it owns; the one new optional saved flag (the vow) must be read strictly and ignored by older builds. Then the tests: \`git diff origin/main...HEAD -- tests src/__tests__\` may change an existing test only in the replacements design 9.3 declares; flag any weakened or removed assertion, any test that passes vacuously, and any design goal without a real proof.` },
]
const g3 = agent(`Carry out task G-7 of ${PLAN} exactly, in ${MAIN} on branch feat/combat-weight. It is read-only: change nothing. ${GATE} Return the written report: each check with pass or fail and the real evidence.`, { label: 'G-7', phase: 'Review', model: 'opus' })
const reviewed = await pipeline(LENSES,
  l => slot(() => agent(l.prompt, { label: `review:${l.key}`, phase: 'Review', model: 'opus', schema: FINDINGS })),
  (r, l) => parallel(((r && r.findings) || []).map(f => () => slot(() =>
    agent(`Try to refute this review finding about ${MAIN} (branch feat/combat-weight). Read the code yourself; change nothing. Finding: ${f.title}. File: ${f.file}${f.line ? ':' + f.line : ''}. Evidence given: ${f.evidence}. Scenario given: ${f.scenario}. Claimed severity: ${f.severity}. Decide whether it is real (the scenario can happen and has the stated effect) and what the right severity is. If you cannot confirm it from the code, real=false.`, { label: `check:${l.key}`, phase: 'Review', model: 'opus', schema: CHECK })
      .then(v => ({ ...f, lens: l.key, check: v }))))))
const findings = reviewed.flat().filter(Boolean)
return { lane, g7: await g3, confirmed: findings.filter(f => f.check && f.check.real), rejected: findings.filter(f => !f.check || !f.check.real).map(f => ({ title: f.title, reason: f.check && f.check.reason })) }
