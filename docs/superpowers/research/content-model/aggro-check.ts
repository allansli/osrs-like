// The aggression rule of design 7.13 (aggro.ts), checked three ways (aggro-results.txt):
//   1. the radius function itself;
//   2. the game's stepMonster (G2 landed the rule in src/state/monsterAi.ts: AFTER) against Stage 2's rule (BEFORE: run.sh
//      reverses G2's two edits in a copy of that file, nothing in src/ is edited), on the cases of tests/monster-territory.test.ts;
//   3. Stage 2's gate simulation (tests/gate-simulation.test.ts, transcribed), before and after.
import { CAMPS, isInSafeZone, type CampDef } from '../../../../src/data/worldMap';
import { MONSTER_TYPES } from '../../../../src/data/world';
import { NODE_PLACEMENTS } from '../../../../src/data/placements';
import { combatLevel } from '../../../../src/state/adventure';
import { rollMonsterHit } from '../../../../src/state/combat';
import { createDefaultState } from '../../../../src/state/gameState';
import * as after from '../../../../src/state/monsterAi';
// @ts-expect-error resolved by run.sh (esbuild alias) to the copy with Stage 2's rule
import * as stage2 from '@stage2/monsterAi';
import { KEEPS_SIGHT, SIGHT_GAP, SIGHT_MIN, packAttackers, sightRadius } from './aggro';

const out: string[] = [];
const p = (s = '') => out.push(s);
let failures = 0;
const check = (ok: boolean, what: string) => { if (!ok) { failures++; p('  FAIL ' + what); } return ok; };
type Ai = typeof after;
const AFTER = after;
const before = stage2 as Ai;
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- 1. the function
p(`=== 1. sightRadius(base, monster level, hero combat, keepsSight): minimum ${SIGHT_MIN}, reached ${SIGHT_GAP} combat levels above the monster`);
p('  hero combat minus monster level:   ' + [-5, 0, 1, 2, 4, 5, 6, 8, 10, 15, 40].map((g) => String(g).padStart(5)).join(''));
for (const [label, base, keeps] of [['melee camp (base 9)', 9, false], ['ranged or magic camp (base 12)', 12, false], ['keeps its sight (sentries, bosses, dungeons)', 9, true]] as const) {
  p(`  ${label.padEnd(34)} ` + [-5, 0, 1, 2, 4, 5, 6, 8, 10, 15, 40].map((g) => sightRadius(base, 30, 30 + g, keeps).toFixed(1).padStart(5)).join(''));
}
for (const base of [5, 9, 12]) {
  let prev = Infinity;
  for (let g = -20; g <= 60; g++) {
    const r = sightRadius(base, 40, 40 + g, false);
    check(r <= prev + 1e-12 && r >= SIGHT_MIN - 1e-12 && r <= base, `monotone, between ${SIGHT_MIN} and ${base} at gap ${g}`);
    check(g > 0 || r === base, `full radius at or below the monster's level (gap ${g})`);
    check(g < SIGHT_GAP || r === SIGHT_MIN, `minimum from ${SIGHT_GAP} levels above (gap ${g})`);
    check(sightRadius(base, 40, 40 + g, true) === base, 'a camp that keeps its sight never shrinks');
    prev = r;
  }
}
check(sightRadius(2, 10, 99, false) === 2, 'a base under the minimum is never widened');
p('  the pacing model\'s count of a pack of 4 (aggro.ts, packAttackers), by hero combat minus monster level: ' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20].map((g) => `${g}:${packAttackers(4, 28, 'melee', 28 + g)}`).join(' '));
for (const pack of [1, 2, 3, 4, 7]) for (const style of ['melee', 'ranged', 'magic']) for (let g = -30; g <= 0; g++) check(packAttackers(pack, 50, style, 50 + g) === pack, 'at or below the monster\'s level the count is the whole pack, as in Stage 2');
for (const pack of [1, 2, 3, 4, 7]) for (let g = SIGHT_GAP; g <= 60; g++) check(packAttackers(pack, 50, 'melee', 50 + g) === 1, `one attacker from ${SIGHT_GAP} levels above, as in Stage 2`);

// ---------------------------------------------------------------- 2. the game's stepMonster against Stage 2's
p();
p('=== 2. The game\'s stepMonster (G2) against Stage 2\'s rule, on the cases of tests/monster-territory.test.ts');
const camp = (id: string, x: number, z: number, radius: number, aggressive: boolean, aggroRadius?: number): CampDef => ({ id, x, z, radius, aggressive, aggroRadius, members: [], keepsSight: KEEPS_SIGHT.includes(id) });
const world = (px: number, pz: number, c: CampDef, playerCombat: number, playerSafe = false) => ({ playerX: px, playerZ: pz, playerDown: false, dt: 0.02, rand: seeded(1), playerCombat, playerSafe, camps: [c] });
function acquires(ai: Ai, type: string, c: CampDef, dist: number, combat: number, steps = 50): boolean {
  const m = ai.createMonsterLogic(type, c.x, c.z, { campId: c.id, wander: 0 });
  m.wanderTimer = 1e9; // stand still: the distance is then exact
  for (let i = 0; i < steps; i++) if (ai.stepMonster(m, world(c.x, c.z + dist, c, combat)).some((e) => e.kind === 'aggro')) return true;
  return false;
}
/** Farthest distance, in steps of 0.05, at which an idle monster at home acquires a hero standing still. */
function reach(ai: Ai, type: string, c: CampDef, combat: number): number {
  let far = 0;
  for (let d = 0.5; d <= 14; d += 0.05) if (acquires(ai, type, c, d, combat, 2)) far = d;
  return far;
}
const goblin = MONSTER_TYPES.goblin.level;
{
  const c = camp('open', 0, 10, 20, true), passive = camp('passive', 0, 10, 20, false);
  p(`  goblin (level ${goblin}), aggressive camp, how far it sees a hero (BEFORE -> AFTER; the function says):`);
  for (const g of [-1, 0, 1, 2, 5, 9, 10, 30]) {
    const b = reach(before, 'goblin', c, goblin + g), a = reach(AFTER, 'goblin', c, goblin + g), want = sightRadius(9, goblin, goblin + g, false);
    p(`    hero ${g >= 0 ? '+' : ''}${g}: ${b.toFixed(2)} -> ${a.toFixed(2)}   (${want.toFixed(2)})`);
    check(Math.abs(a - want) <= 0.051, `the game's reach equals sightRadius at gap ${g}`);
    if (g <= 0) check(Math.abs(a - b) < 1e-9, `unchanged at or below the monster's level (gap ${g})`);
  }
  for (const type of ['goblin_archer', 'dark_wizard']) { const lv = MONSTER_TYPES[type].level; check(Math.abs(reach(AFTER, type, c, lv) - 12) <= 0.051 && Math.abs(reach(AFTER, type, c, lv + 40) - SIGHT_MIN) <= 0.051, `${type}: 12 at its level, ${SIGHT_MIN} far above`); }
  check(!acquires(AFTER, 'goblin', passive, 1, 1, 600), 'a passive camp never starts a fight, at any level');
  check(!acquires(AFTER, 'goblin', passive, 1, 99, 600), 'a passive camp never starts a fight, at any level');
  const keeps = camp(KEEPS_SIGHT[0], 0, 10, 20, true);
  check(Math.abs(reach(AFTER, 'goblin', keeps, 126) - 9) <= 0.051, 'a camp that keeps its sight sees a level-126 hero at 9');
  p('  the one Stage 2 case that changes (monster-territory.test.ts, "an aggressive camp ignores a player whose combat level is above the monster\'s"):');
  const small = camp('aggro_level', 0, 10, 12, true);
  p(`    hero one level above, 2 units away, 50 steps: BEFORE ${acquires(before, 'goblin', small, 2, goblin + 1) ? 'attacked' : 'ignored'}, AFTER ${acquires(AFTER, 'goblin', small, 2, goblin + 1) ? 'attacked' : 'ignored'}`);
  p(`    hero ${SIGHT_GAP} levels above, 3.5 units away: AFTER ${acquires(AFTER, 'goblin', small, 3.5, goblin + SIGHT_GAP) ? 'attacked' : 'ignored'}; 2.9 units away: AFTER ${acquires(AFTER, 'goblin', small, 2.9, goblin + SIGHT_GAP) ? 'attacked' : 'ignored'}`);
  check(!acquires(before, 'goblin', small, 2, goblin + 1) && acquires(AFTER, 'goblin', small, 2, goblin + 1), 'the replaced assertion');
  check(!acquires(AFTER, 'goblin', small, 3.5, goblin + SIGHT_GAP) && acquires(AFTER, 'goblin', small, 2.9, goblin + SIGHT_GAP), 'far above: only at about strike range');
  check(acquires(before, 'goblin', small, 2, goblin) && acquires(AFTER, 'goblin', small, 2, goblin), 'equal level still attacks (the second half of that test, unchanged)');
  // every other acquisition case of that file plays a hero of combat 1 against a goblin, an archer or a wizard: at or below their level
  for (const type of ['goblin', 'goblin_archer', 'dark_wizard']) check(MONSTER_TYPES[type].level >= 1, `${type} is not below the tests' hero of combat 1`);
  check(!AFTER.stepMonster(AFTER.createMonsterLogic('goblin', 0, 10, { campId: 'open' }), world(0, 12, c, 1, true)).some((e) => e.kind === 'aggro'), 'no aggro on a safe hero (grace, safe zone): unchanged');
}

// ---------------------------------------------------------------- 3. the gate
p();
p('=== 3. Stage 2\'s gate simulation (tests/gate-simulation.test.ts), 1,000 seeds on each of the three lines');
const SEEDS = 1000, RUN_SPEED = 11.5, DT = 1 / 60, START_X = -8, END_X = -80, LINES = [55, 52.5, 57.5];
const sentryCamp = CAMPS.find((c) => c.id === 'pass_sentries')!;
type Character = ReturnType<typeof createDefaultState>;
const fresh = () => createDefaultState();
const prayedForty = () => { const s = createDefaultState(); s.skills.hitpoints.lvl = 40; s.hp = 40; s.activePrayers.add('prot_melee'); return s; };
const veteran = (prayer: boolean) => () => { const s = createDefaultState(); for (const k of ['attack', 'strength', 'defence', 'hitpoints']) s.skills[k].lvl = 70; s.hp = 70; s.maxHp = 70; for (const [slot, id] of Object.entries({ weapon: 'dragon_scimitar', body: 'dragon_chain', legs: 'dragon_legs' })) s.equipment[slot] = id; if (prayer) s.activePrayers.add('prot_melee'); return s; };
function run(ai: Ai, make: () => Character, lineZ: number, seed: number, stopOnDeath = true) {
  const rand = seeded(seed), state = make(), playerCombat = combatLevel(state);
  const sentries = sentryCamp.members.map((mem) => { const m = ai.createMonsterLogic(mem.type, mem.x, mem.z, { campId: sentryCamp.id, wander: mem.wander }); m.wanderTimer = rand() * 3; return m; });
  const attacks = sentries.map(() => 0);
  let hp = state.hp, px = START_X;
  while (px > END_X) {
    px = Math.max(END_X, px - RUN_SPEED * DT);
    const w = { playerX: px, playerZ: lineZ, playerDown: stopOnDeath && hp <= 0, dt: DT, rand, playerCombat, playerSafe: isInSafeZone(px, lineZ), camps: CAMPS };
    sentries.forEach((m, i) => { for (const ev of ai.stepMonster(m, w)) { if (ev.kind !== 'attack') continue; attacks[i] += 1; m.breathCount += 1; hp -= rollMonsterHit(m.typeKey, m.breathCount, state, rand).dmg; } });
    if (stopOnDeath && hp <= 0) return { survived: false, attacks, hp };
  }
  return { survived: hp > 0, attacks, hp };
}
function gate(ai: Ai, make: () => Character) {
  const surv = LINES.map((z) => { let n = 0; for (let s = 1; s <= SEEDS; s++) if (run(ai, make, z, s).survived) n++; return n / SEEDS; });
  let least = Infinity, total = 0, trace = 0;
  for (const z of LINES) for (let s = 1; s <= SEEDS; s++) { const r = run(ai, make, z, s, false); least = Math.min(least, ...r.attacks); total += r.attacks.reduce((a, b) => a + b, 0); trace = (trace * 31 + Math.round(r.hp * 1000) + r.attacks.reduce((a, b) => a * 7 + b, 0)) % 1000000007; }
  return { surv, least, mean: total / (LINES.length * SEEDS), trace };
}
p('  hero                                                  combat | BEFORE survives (three lines)   fewest attacks by a sentry, mean attacks a crossing | AFTER the same');
const rows: [string, () => Character, boolean][] = [
  ['fresh character, 10 hitpoints, no prayer (the test)', fresh, true],
  ['40 hitpoints and Protect from Melee (the test)', prayedForty, true],
  ['every melee skill 70, dragon kit, no prayer', veteran(false), false],
  ['the same with Protect from Melee', veteran(true), false]
];
for (const [label, make, sameWanted] of rows) {
  const b = gate(before, make), a = gate(AFTER, make);
  const f = (g: typeof b) => `${g.surv.map((x) => (x * 100).toFixed(1) + '%').join(' ').padEnd(22)} ${String(g.least).padStart(3)} ${g.mean.toFixed(2).padStart(7)}`;
  p(`  ${label.padEnd(52)} ${String(combatLevel(make())).padStart(5)}  | ${f(b)} | ${f(a)}${b.trace === a.trace ? '   identical, blow for blow' : ''}`);
  if (sameWanted) check(b.trace === a.trace, `gate unchanged for: ${label}`);
}
{
  const f = gate(AFTER, fresh), q = gate(AFTER, prayedForty);
  check(f.surv.every((x) => x < 0.05), 'the test\'s first bound: a fresh character survives fewer than 5% of runs');
  check(q.surv.every((x) => x === 1), 'the test\'s second bound: 40 hitpoints and Protect from Melee survives every run');
  check(f.least >= 1 && q.least >= 1, 'the test\'s third bound: every run records at least one attack per sentry');
  check(KEEPS_SIGHT.includes(sentryCamp.id) && !!sentryCamp.keepsSight && sentryCamp.aggressive, 'the sentries keep their sight');
  for (const c of CAMPS) check(!!c.keepsSight === KEEPS_SIGHT.includes(c.id), `keepsSight of camp ${c.id} in the game equals aggro.ts KEEPS_SIGHT`);
}
p(`  the sentries are level ${MONSTER_TYPES.lesser_demon.level}: under Stage 2's rule a hero of combat ${MONSTER_TYPES.lesser_demon.level + 1} or more walked through untouched; now the pass tests every hero, and a prepared one passes.`);

// ---------------------------------------------------------------- 4. who is newly exposed: gatherers inside aggressive camps
p();
p('=== 4. Resource nodes inside an aggressive camp: can a hero far above the camp still be attacked while gathering?');
p('  A monster wanders up to its wander radius (4.5; the sentries 1) from home and sees such a hero at ' + SIGHT_MIN + '. A gatherer stands about 2 from the node.');
{
  let exposed = 0, inside = 0;
  for (const n of NODE_PLACEMENTS) for (const c of CAMPS.filter((x) => x.aggressive)) {
    if (Math.hypot(n.x - c.x, n.z - c.z) > c.radius) continue;
    inside++;
    const near = Math.min(...c.members.map((m) => Math.hypot(n.x - m.x, n.z - m.z) - (m.wander ?? 4.5)));
    const can = near <= SIGHT_MIN + 2;
    if (can) exposed++;
    p(`    ${n.type.padEnd(12)} (${n.x}, ${n.z}) in ${c.id}: a ${c.members[0].type} can wander to within ${Math.max(0, near).toFixed(1)} of it: ${can ? 'CAN be attacked there at any level' : 'safe from a hero ' + SIGHT_GAP + ' levels above'}`);
  }
  p(`  ${inside} nodes stand inside aggressive camps; at ${exposed} of them a hero of any level can now be attacked while gathering (under Stage 2's rule a hero above the camp's level never was).`);
}

p();
p(failures === 0 ? 'ALL AGGRESSION CHECKS PASS' : `${failures} CHECK(S) FAILED`);
console.log(out.join('\n'));
if (failures) process.exitCode = 1;
