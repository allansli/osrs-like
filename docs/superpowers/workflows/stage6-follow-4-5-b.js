export const meta = {
  name: 'stage6-follow-4-5-b',
  description: 'Stage 6: slice 3 to 3b follow-ups (SF1-SF6, gate rerun), then slices 4 (Crafting) and 5 (Runebinding), serially. Opus verify each. No push.',
  phases: [{ title: 'Lanes', detail: 'two lanes' }],
}
const PLAN = 'docs/superpowers/plans/2026-11-14-content-systems-plan.md'
const DESIGN = 'docs/superpowers/specs/2026-11-14-content-systems-design.md'
const LOGS = '/tmp/claude-1000/-home-rdrosa-gitprojects-allan-osrs-like/49c111c4-413d-4c3a-9eed-67685c0d7161/scratchpad/agy'
const ROOT = '/home/rdrosa/gitprojects/allan/osrs-like-wp'
const MODRULES = 'Models-pass rules apply to this lane: read docs/superpowers/plans/2026-11-14-models-pass-plan.md section 0 (BLEND, COMPARE, SHEETS lines and the promote), docs/superpowers/specs/2026-11-14-models-pass-design.md sections 5 and 9.1, docs/superpowers/baseline/models/README.md (the pilot pattern) and docs/superpowers/baseline/models/final.md (To Stage 6). Build into scratch/models-build only; never write public/models or blender/ before MP6. '
const LANES = [
  { name: 'main', dir: 'S6', branch: 'feat/content-systems', tasks: [
    { id: 'SF3', kind: 'work', model: 'opus', hb: '01a36ee', part: 'finish task SF3 as the SF3 ratification section at the end of the plan says (earlier SF3 commits are on the branch), with GPU captures (scripts/capture-gpu.mjs) as evidence. A repair or a task that needs a file outside its list writes a proposed amendment in the plan for the main session.' },
    { id: 'SF4', kind: 'work', model: 'opus', part: 'task SF4 of the plan section Slices 3 to 3b follow-ups, in full, measured with the perf HUD on the GPU. A repair or a task that needs a file outside its list writes a proposed amendment in the plan for the main session.' },
    { id: 'SF5', kind: 'agy', note: 'task SF5 of the plan section Slices 3 to 3b follow-ups' },
    { id: 'SF6', kind: 'work', model: 'opus', part: 'task SF6 of the plan section Slices 3 to 3b follow-ups, in full. A repair or a task that needs a file outside its list writes a proposed amendment in the plan for the main session.' },
    { id: 'SG3', kind: 'work', model: 'opus', part: 'task SG3 of the plan section Slices 3 to 3b follow-ups: the agent part of the three gates again with GPU captures; the owner checks stay open. A repair or a task that needs a file outside its list writes a proposed amendment in the plan for the main session.' },
    { id: 'K1', kind: 'work', model: 'sonnet', part: 'task K1 (tests only), with what the Z4 and Z5 repair amendments add to it. A repair or a task that needs a file outside its list writes a proposed amendment in the plan for the main session.' },
    { id: 'K2', kind: 'agy', note: 'task K2, with what the Z4 amendment (Tough Hide in the Warren chest, Chitin Plate on scree_skitter) and the Z5 repair amendment (ml_salt crafting XP and the save top-up, in their own commits) add to it' },
    { id: 'K3', kind: 'agy' },
    { id: 'K4', kind: 'work', model: 'opus', part: 'task K4 in full (the writing). A repair or a task that needs a file outside its list writes a proposed amendment in the plan for the main session.' },
    { id: 'G-6.4', kind: 'work', model: 'opus', part: 'task G-6.4, the agent part, with GPU captures of the bench, the recipe panel and Nothing Wasted under docs/superpowers/baseline/s6/g64/; H-4 stays open for the owner. A repair or a task that needs a file outside its list writes a proposed amendment in the plan for the main session.' },
    { id: 'N1', kind: 'work', model: 'sonnet', part: 'task N1 (tests only), with the declared edits that the plan section Revision 2026-11-26 gives N1. A repair or a task that needs a file outside its list writes a proposed amendment in the plan for the main session.' },
    { id: 'N2', kind: 'agy' },
    { id: 'N3', kind: 'agy' },
    { id: 'N4', kind: 'work', model: 'fable', part: 'task N4 in full (the writing of chapters 4 and 5 and Blank Stones). A repair or a task that needs a file outside its list writes a proposed amendment in the plan for the main session.' },
    { id: 'G-6.5', kind: 'work', model: 'opus', part: 'task G-6.5, the agent part, with GPU captures under docs/superpowers/baseline/s6/g65/; H-5 stays open for the owner. A repair or a task that needs a file outside its list writes a proposed amendment in the plan for the main session.' },
  ] },
]
const RUN_SCHEMA = { type: 'object', properties: { head_before: { type: 'string' }, head_after: { type: 'string' }, agy_exit: { type: 'string' }, status_short: { type: 'string' }, log_tail: { type: 'string' } }, required: ['head_before', 'head_after', 'agy_exit', 'status_short'] }
const WORK_SCHEMA = { type: 'object', properties: { head_before: { type: 'string' }, head_after: { type: 'string' }, summary: { type: 'string' } }, required: ['head_before', 'head_after', 'summary'] }
const VERDICT_SCHEMA = { type: 'object', properties: { pass: { type: 'boolean' }, defects: { type: 'array', items: { type: 'string' } }, gate: { type: 'string' }, notes: { type: 'string' } }, required: ['pass', 'defects', 'gate'] }
const GATE = 'Gate commands, always from the worktree root and always behind the machine-wide lock: `flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run` (SUITE), `flock /tmp/claude-capped.lock scripts/capped.sh npx vitest run <file>` (ONE), `flock /tmp/claude-capped.lock scripts/capped.sh npx tsc --noEmit` (TYPES), `flock /tmp/claude-capped.lock scripts/capped.sh npm run build` (BUILD). Every Blender command (the plan\'s BLEND and SHEETS lines) runs as `flock /tmp/claude-blender.lock <the plan\'s line>`. Never run npm install or npm ci.'
const DECISIONS = 'Stage 6 (content and systems) design and plan were approved by the owner (O-6.1), with the CALL answers recorded in the design (section 15) and the plan (table 0.5): CALL-6.24 rebalance approved but re-shown at O-6.6 before S1; CALL-6.29 option (b); CALL-6.30 to 6.32 approved; CALL-6.33 (a), 13.5 s in the cave. Amendments and review-log entries at the end of both win over older text. Stages 1 to 5 and the models pass are merged to main and merged into this branch. Slices 0 and 1 (R0 to G-6.1, with the models lane) slices 2, 3, 3a and 3b (to G-6.3b) (kits and boss bodies, promoted, merged) are done and verified; it stopped on O-6.1b, which the owner answered on 2026-11-26 with every recommendation (plan section Revision 2026-11-26). The owner retired the hard JS-size limit on 2026-11-26: report the chunk size, never treat it as a ceiling. Tests run only through the capped wrapper (the plan 0.2 systemd-run lines are obsolete). At most one capped run and one Blender process at a time machine-wide. Agents never download or install programs and never leave a server running.'
function ctx(lane) { return `Work only in ${ROOT}/${lane.dir} on branch ${lane.branch}; never touch another directory or branch. Two lanes run at once in separate worktrees. ${DECISIONS}` }
function agyRun(lane, t) {
  const dir = `${ROOT}/${lane.dir}`
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
      hb = t.hb || r.head_before
    }
    let v = null
    for (let round = 1; round <= 6; round++) {
      v = await agent(verify(lane, t, hb, round), { label: `${L}:verify-${round}`, phase: 'Lanes', model: 'opus', schema: VERDICT_SCHEMA })
      if (!v || v.pass || round === 6) break
      log(`${L}: round ${round}, ${v.defects.length} defect(s)`)
      const rm = t.id === 'H3b' ? 'opus' : (t.kind === 'work' && (t.model === 'opus' || t.model === 'fable') ? t.model : (round >= 3 ? 'opus' : 'sonnet'))
      await agent(repair(lane, t, hb, v.defects), { label: `${L}:repair-${round}`, phase: 'Lanes', model: rm, schema: WORK_SCHEMA })
    }
    if (!v) return { lane: lane.name, done, stopped: `${t.id}: verifier returned nothing` }
    done.push({ id: t.id, pass: v.pass, gate: v.gate, defects: v.pass ? [] : v.defects, notes: (v.notes || '').slice(0, 1500) })
    if (!v.pass) return { lane: lane.name, done, stopped: `${t.id}: still failing after 6 rounds` }
    log(`${L}: verified`)
  }
  return { lane: lane.name, done, stopped: null }
}
phase('Lanes')
const results = await parallel(LANES.map((lane) => () => runLane(lane)))
return results
