export const meta = {
  name: 'stage2-review-fixes',
  description: 'Stage 2: fix the 13 confirmed review findings on the stage branch, test first, then verify. No push, no merge.',
  phases: [
    { title: 'Rules', detail: 'findings 0, 1, 2, 3, 12: fix, opus verify, repair' },
    { title: 'World', detail: 'findings 4-11: fix, opus verify, repair' },
  ],
}

const MAIN = '/home/rdrosa/gitprojects/allan/osrs-like'
const FINDINGS = 'docs/superpowers/baseline/stage2-review-findings.json'
const PLAN = 'docs/superpowers/plans/2026-11-13-world-foundation-plan.md'
const DESIGN = 'docs/superpowers/specs/2026-11-13-world-foundation-design.md'
const GATE = 'Gate commands, always through the wrapper from the repo root and never two at once: `scripts/capped.sh npx vitest run` (or with one file), `scripts/capped.sh npx tsc --noEmit`, `scripts/capped.sh npm run build`.'
const WORK = { type: 'object', properties: { head_before: { type: 'string' }, head_after: { type: 'string' }, summary: { type: 'string' } }, required: ['head_before', 'head_after', 'summary'] }
const VERDICT = { type: 'object', properties: { pass: { type: 'boolean' }, defects: { type: 'array', items: { type: 'string' } }, gate: { type: 'string' } }, required: ['pass', 'defects', 'gate'] }

const GROUPS = [
  { key: 'Rules', ids: [0, 1, 2, 3, 12], model: 'opus',
    note: 'Finding 0: a returning monster that cannot reach home must not stay immune for ever; give the return state the same stall test as chase and on stall put it home with the arrival effects (full HP, breathCount 0, reset event). Finding 1: the hero must not push against water or walls on the last segment to a resource or station. Finding 2: attacking a returning monster spends nothing and drops the target, with the message once. Finding 3: a click on walkable ground whose cell centre is blocked routes to the nearest open cell and ends on the clicked point. Finding 12: move the 3-second grace into a pure tested helper in src/state and have the engine call it.' },
  { key: 'World', ids: [4, 5, 6, 7, 8, 9, 10, 11], model: 'sonnet',
    note: 'Finding 4: the minimap ridge stroke leaves the pass open. Finding 5: each point of interest shows its name in game the way signposts do. Findings 6, 7, 8: move the tree, the oak and the tent or goblin as the fixes say, and add the world-data assertions that would have caught them. Finding 9: correct the README world table from the data. Finding 10: the save-relocation tests assert the loaded pose is near the saved one. Finding 11: make the budget test count the real per-call cost.' },
]

function fixPrompt(g) {
  return `Fix confirmed review findings of Stage 2 of a browser game. Work in ${MAIN} on branch feat/world-place, directly on that branch. No other agent is editing it now.
Read ${FINDINGS}: the array "confirmed"; fix the entries at indexes ${g.ids.join(', ')} (each has title, file, line, evidence, scenario, fix, and the checker's reason). Read the code around each before editing, and the parts of ${DESIGN} section 6 and ${PLAN} (section 0 rules, and the Stage 2 task that owns the code) that apply. ${g.note}
Rules: for each finding write a failing test first where a test can show it (pure code in src/state or data), then the smallest fix that makes it pass; engine-only wiring that cannot be unit-tested is fixed and described. Never weaken, skip or delete an existing assertion; if an existing test must change because it pinned the defect, stop and report it instead. No new dependency, no explicit any, no @ts-ignore, no defaulting fallback that hides a missing value. Do not change any combat formula, stop distance, speed or monster stat. One commit per finding, message \`fix(review-N): <what>\` with N the index, no attribution trailer of any kind. Do not push, merge or tag. ${GATE} The full gate must pass at the end.
Return head_before (git rev-parse HEAD before your work), head_after, and a summary: per finding, what changed, the test that proves it, or why none was possible; and the real gate output.`
}
function verifyPrompt(g, before, round) {
  return `Verify fixes for review findings of Stage 2. You are the independent check: change nothing, commit nothing. Repo ${MAIN}, branch feat/world-place; the work is the commits after ${before} up to HEAD. Round ${round}.
Read ${FINDINGS} ("confirmed", indexes ${g.ids.join(', ')}) and the diff. For each finding decide from the code, and from commands you run, whether the scenario in the finding can still happen. Check that each new test fails without its fix (read it; reason about it or revert the fix in a scratch copy outside the repo, never in the repo), that no existing assertion was weakened or removed (\`git diff ${before} -- tests\`), that nothing outside the findings changed, that no formula, stop distance, speed or stat changed, and that commit messages carry no attribution trailer. ${GATE} Run the full gate.
Return pass=true only if every listed finding is closed and nothing needs fixing; otherwise one concrete sentence per defect. Put the real gate result in gate.`
}
function repairPrompt(g, before, defects) {
  return `Repair fixes for review findings of Stage 2 in ${MAIN}, branch feat/world-place (commits after ${before}). Findings file: ${FINDINGS}, "confirmed" indexes ${g.ids.join(', ')}. Verification found these defects; fix all of them:
${defects.map((d, i) => `${i + 1}. ${d}`).join('\n')}
Same rules as the original work: failing test first where possible, never weaken an existing assertion, no formula or stat change, new commits \`fix(review-N): ...\` with no attribution trailer, no push. ${GATE} Return head_before = ${before}, head_after and a summary with the real gate output.`
}

const out = []
for (const g of GROUPS) {
  phase(g.key)
  const w = await agent(fixPrompt(g), { label: `fix:${g.key}`, phase: g.key, model: g.model, schema: WORK })
  if (!w) { out.push({ group: g.key, pass: false, reason: 'fixer returned nothing' }); break }
  let v = null
  for (let round = 1; round <= 3; round++) {
    v = await agent(verifyPrompt(g, w.head_before, round), { label: `verify:${g.key}-${round}`, phase: g.key, model: 'opus', schema: VERDICT })
    if (!v || v.pass || round === 3) break
    log(`${g.key}: round ${round} found ${v.defects.length} defect(s)`)
    await agent(repairPrompt(g, w.head_before, v.defects), { label: `repair:${g.key}-${round}`, phase: g.key, model: 'opus', schema: WORK })
  }
  out.push({ group: g.key, pass: !!(v && v.pass), gate: v && v.gate, defects: v ? v.defects : ['verifier returned nothing'], summary: w.summary })
  if (!v || !v.pass) break
}
return out
