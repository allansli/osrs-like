export const meta = {
  name: 'stage4-review-fixes',
  description: 'Stage 4: fix the 17 confirmed review findings and the three gate items on the stage branch, test first, verify, then rerun the gate G-7. No push, no merge.',
  phases: [
    { title: 'Combat', detail: 'findings 0-4' },
    { title: 'Feel', detail: 'findings 5-14' },
    { title: 'Proofs', detail: 'findings 15, 16, gate items 18 and 19' },
    { title: 'Size', detail: 'gate item 17 (JS budget)' },
    { title: 'Gate', detail: 'G-7 rerun' },
  ],
}

const MAIN = '/home/rdrosa/gitprojects/allan/osrs-like-wp/S4'
const FINDINGS = 'docs/superpowers/baseline/stage4-review-findings.json'
const PLAN = 'docs/superpowers/plans/2026-11-14-combat-weight-plan.md'
const DESIGN = 'docs/superpowers/specs/2026-11-14-combat-weight-design.md'
const GATE = 'Gate commands, always through the wrapper from the repo root and never two at once: `scripts/capped.sh npx vitest run` (or with one file), `scripts/capped.sh npx tsc --noEmit`, `scripts/capped.sh npm run build`.'
const WORK = { type: 'object', properties: { head_before: { type: 'string' }, head_after: { type: 'string' }, summary: { type: 'string' } }, required: ['head_before', 'head_after', 'summary'] }
const VERDICT = { type: 'object', properties: { pass: { type: 'boolean' }, defects: { type: 'array', items: { type: 'string' } }, gate: { type: 'string' } }, required: ['pass', 'defects', 'gate'] }

const GROUPS = [
  { key: 'Combat', ids: [0, 1, 2, 3, 4], model: 'opus', note: 'Combat rules: the melee re-click, the pulling hit during the opening roar, a vow that guards nothing, the altar chat line, and a stale route after respawn.' },
  { key: 'Feel', ids: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14], model: 'opus', note: 'Engine feel: telegraph fill culling, the nova ring fill, the fill re-sampling terrain every frame (cache heights at build time; keep the halo and band from T6 as they are), knock-back frame, hit stop on monsters and the procedural hero, the wind-up sound on cancel, the zero-damage heavy thump, the camera kick against the lerped camera, and the wind-up cue timing.' },
  { key: 'Proofs', ids: [15, 16, 18, 19], model: 'opus', note: 'Index 18 is gate item 6 and index 19 is gate item 8; read their fix fields. The two scan tests are files this stage added, so they may be extended.' },
  { key: 'Size', ids: [17], model: 'opus', note: 'Index 17 is gate item 2, the JS budget. Measure before cutting; never remove a feature or weaken a test; if the budget cannot be met without that, stop and return the breakdown.' },
]

function fixPrompt(g) {
  return `Fix confirmed review findings of Stage 4 of a browser game. Work in ${MAIN} on branch feat/combat-weight, directly on that branch, and never touch another directory. No other agent is editing it now.
Read ${FINDINGS}: the array "confirmed"; fix the entries at indexes ${g.ids.join(', ')} (each has title, file, line, evidence, scenario, fix, and the checker's reason). Read the code around each before editing, and the parts of ${DESIGN} and ${PLAN} (section 0 rules, and the task that owns the code) that apply. ${g.note}
Rules: for each finding write a failing test first where a test can show it (pure code in src/state or data), then the smallest fix that makes it pass; engine-only wiring that cannot be unit-tested is fixed and described. Never weaken, skip or delete an existing assertion. Files under tests/ and src/__tests__ that exist on origin/main are frozen (plan rule 0.3.3) except the replacements design 9.3 declares; a test file this stage added may be extended. Read the approval note at the top of the design: it wins over section text. If an existing test must change because it pinned the defect, stop and report it instead. No new dependency, no explicit any, no @ts-ignore, no defaulting fallback that hides a missing value. Do not change any combat formula, monster stat, price, drop, timing in attacks.ts, or proof threshold. One commit per finding, message \`fix(review-N): <what>\` with N the index, no attribution trailer of any kind. Do not push, merge or tag. ${GATE} The full gate must pass at the end.
Return head_before (git rev-parse HEAD before your work), head_after, and a summary: per finding, what changed, the test that proves it, or why none was possible; and the real gate output.`
}
function verifyPrompt(g, before, round) {
  return `Verify fixes for review findings of Stage 4. You are the independent check: change nothing, commit nothing. Repo ${MAIN}, branch feat/combat-weight; the work is the commits after ${before} up to HEAD. Round ${round}.
Read ${FINDINGS} ("confirmed", indexes ${g.ids.join(', ')}) and the diff. For each finding decide from the code, and from commands you run, whether the scenario in the finding can still happen. Check that each new test fails without its fix (read it; reason about it or revert the fix in a scratch copy outside the repo, never in the repo), that no existing assertion was weakened or removed (\`git diff ${before} -- tests\`), that nothing outside the findings changed, that no combat formula, stat, price, drop, attack timing or proof threshold changed, that no file under tests/ or src/__tests__ that exists on origin/main was edited beyond the replacements design 9.3 declares, and that commit messages carry no attribution trailer. ${GATE} Run the full gate.
Return pass=true only if every listed finding is closed and nothing needs fixing; otherwise one concrete sentence per defect. Put the real gate result in gate.`
}
function repairPrompt(g, before, defects) {
  return `Repair fixes for review findings of Stage 4 in ${MAIN}, branch feat/combat-weight (commits after ${before}). Findings file: ${FINDINGS}, "confirmed" indexes ${g.ids.join(', ')}. Verification found these defects; fix all of them:
${defects.map((d, i) => `${i + 1}. ${d}`).join('\n')}
Same rules as the original work: failing test first where possible, never weaken an existing assertion, no formula, stat, timing or threshold change, new commits \`fix(review-N): ...\` with no attribution trailer, no push. ${GATE} Return head_before = ${before}, head_after and a summary with the real gate output.`
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
phase('Gate')
const ok = out.every(o => o.pass)
const g7 = ok ? await agent(`Carry out task G-7 of ${PLAN} exactly, in ${MAIN} on branch feat/combat-weight. It is read-only: change nothing. ${GATE} The JS budget is the R0 baseline (955.97 kB) plus 30 kB. Return the written report: each check with pass or fail and the real evidence.`, { label: 'G-7 rerun', phase: 'Gate', model: 'opus' }) : null
return { groups: out, g7 }
