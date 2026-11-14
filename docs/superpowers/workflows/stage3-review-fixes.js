export const meta = {
  name: 'stage3-review-fixes',
  description: 'Stage 3: fix the 10 confirmed review findings on the stage branch, test first, then verify. No push, no merge.',
  phases: [
    { title: 'Game', detail: 'findings 3, 4, 0, 1, 2, 5: fix, opus verify, repair' },
    { title: 'Proofs', detail: 'findings 6-9: fix, opus verify, repair' },
  ],
}

const MAIN = '/home/rdrosa/gitprojects/allan/osrs-like-wp/S3'
const FINDINGS = 'docs/superpowers/baseline/stage3-review-findings.json'
const PLAN = 'docs/superpowers/plans/2026-11-14-start-pacing-plan.md'
const DESIGN = 'docs/superpowers/specs/2026-11-14-start-pacing-design.md'
const GATE = 'Gate commands, always through the wrapper from the repo root and never two at once: `scripts/capped.sh npx vitest run` (or with one file), `scripts/capped.sh npx tsc --noEmit`, `scripts/capped.sh npm run build`.'
const WORK = { type: 'object', properties: { head_before: { type: 'string' }, head_after: { type: 'string' }, summary: { type: 'string' } }, required: ['head_before', 'head_after', 'summary'] }
const VERDICT = { type: 'object', properties: { pass: { type: 'boolean' }, defects: { type: 'array', items: { type: 'string' } }, gate: { type: 'string' } }, required: ['pass', 'defects', 'gate'] }

const GROUPS = [
  { key: 'Game', ids: [3, 4, 0, 1, 2, 5], model: 'opus',
    note: 'Finding 3 is the serious one: starter quest 6 cannot be completed because no buy path sets the bought flag; set it where every buy passes (the pure buy functions in src/state/inventory.ts) and prove it with a test that buys through the same functions the shop buttons call, for equipment and for a rune pack. Finding 4: every sell path sets the sold flag once, in the pure sell functions. Finding 0: a level gained from quest or Slayer experience prints the same unlock line as one gained from an action, through one shared helper. Finding 1: the unlock line reads the live node table and announces the Maple Tree. Finding 2: no shop price is quoted for goods the store does not sell. Finding 5: Reset also clears the onboarding key.' },
  { key: 'Proofs', ids: [6, 7, 8, 9], model: 'sonnet',
    note: 'Finding 6: the fishing depletion rule becomes a value in src/state/economy.ts that the engine calls and the tests and the pacing model import; no source-text scan and no silent assumption. Finding 7: the boot notices become a pure helper tested with a 10x save, a 1x save and a new game. Finding 8: the existing-save cases check what the design lists. Finding 9: one test proves no inline hit, drop or gather formula is left in src/engine/actions.ts. These add or extend NEW Stage 3 test files only.' },
]

function fixPrompt(g) {
  return `Fix confirmed review findings of Stage 3 of a browser game. Work in ${MAIN} on branch feat/start-pacing, directly on that branch, and never touch another directory. No other agent is editing it now.
Read ${FINDINGS}: the array "confirmed"; fix the entries at indexes ${g.ids.join(', ')} (each has title, file, line, evidence, scenario, fix, and the checker's reason). Read the code around each before editing, and the parts of ${DESIGN} and ${PLAN} (section 0 rules, and the task that owns the code) that apply. ${g.note}
Rules: for each finding write a failing test first where a test can show it (pure code in src/state or data), then the smallest fix that makes it pass; engine-only wiring that cannot be unit-tested is fixed and described. Never weaken, skip or delete an existing assertion. Files under tests/ and src/__tests__ that exist on origin/main are frozen (plan rule 0.3.3); a test file this stage added may be extended. No test may assert a time of play (rule 0.3.10) and no saved field may be added (rule 0.3.11). If an existing test must change because it pinned the defect, stop and report it instead. No new dependency, no explicit any, no @ts-ignore, no defaulting fallback that hides a missing value. Do not change any formula, price, requirement, drop rate, recipe or reward. One commit per finding, message \`fix(review-N): <what>\` with N the index, no attribution trailer of any kind. Do not push, merge or tag. ${GATE} The full gate must pass at the end.
Return head_before (git rev-parse HEAD before your work), head_after, and a summary: per finding, what changed, the test that proves it, or why none was possible; and the real gate output.`
}
function verifyPrompt(g, before, round) {
  return `Verify fixes for review findings of Stage 3. You are the independent check: change nothing, commit nothing. Repo ${MAIN}, branch feat/start-pacing; the work is the commits after ${before} up to HEAD. Round ${round}.
Read ${FINDINGS} ("confirmed", indexes ${g.ids.join(', ')}) and the diff. For each finding decide from the code, and from commands you run, whether the scenario in the finding can still happen. Check that each new test fails without its fix (read it; reason about it or revert the fix in a scratch copy outside the repo, never in the repo), that no existing assertion was weakened or removed (\`git diff ${before} -- tests\`), that nothing outside the findings changed, that no formula, price, requirement, drop rate, recipe or reward changed, that no file under tests/ or src/__tests__ that exists on origin/main was edited except the one declared line of tests/phase3-content.test.ts, and that commit messages carry no attribution trailer. ${GATE} Run the full gate.
Return pass=true only if every listed finding is closed and nothing needs fixing; otherwise one concrete sentence per defect. Put the real gate result in gate.`
}
function repairPrompt(g, before, defects) {
  return `Repair fixes for review findings of Stage 3 in ${MAIN}, branch feat/start-pacing (commits after ${before}). Findings file: ${FINDINGS}, "confirmed" indexes ${g.ids.join(', ')}. Verification found these defects; fix all of them:
${defects.map((d, i) => `${i + 1}. ${d}`).join('\n')}
Same rules as the original work: failing test first where possible, never weaken an existing assertion, no formula, price or data change, new commits \`fix(review-N): ...\` with no attribution trailer, no push. ${GATE} Return head_before = ${before}, head_after and a summary with the real gate output.`
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
