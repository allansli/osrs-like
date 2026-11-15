// Numbers for the owner's decisions of 2026-11-14 (design 6.4, 6.6): what a death costs and what the
// blessing costs, the two regeneration rates against the Stage 2 gate, and where the new boss's arena fits.
// Imports the game's real tables and pure functions. Seeded. Run with run.sh.
import { MONSTER_TYPES } from '../../../../src/data/world';
import { CAMPS, PATHS, POIS, SAFE_ZONES, isInSafeZone } from '../../../../src/data/worldMap';
import { NODE_PLACEMENTS } from '../../../../src/data/placements';
import { OSRS_XP_TABLE, getLevelForXp } from '../../../../src/data/skills';
import { combatLevel } from '../../../../src/state/adventure';
import { rollMonsterHit } from '../../../../src/state/combat';
import { createDefaultState } from '../../../../src/state/gameState';
import { createMonsterLogic, stepMonster } from '../../../../src/state/monsterAi';
import { buildWalkGrid, findPath } from '../../../../src/state/pathfind';
import { getTerrainHeight } from '../../../../src/state/terrain';
import { ARENA, BOSS_KEY } from './boss';

const p = (...a: unknown[]) => console.log(...a);
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- 1. what a death costs (design 6.6)
// Rule: each fighting skill loses min(experience earned inside its current level, SHARE x that level's span).
export const FIGHTING_SKILLS = ['attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic'];
export const NO_LOSS_BELOW_COMBAT = 15;
const VOW_COINS_PER_XP = 1, VOW_FLOOR = 250;
/** Span of a level; level 99 has no next level, so it uses the span of 98 to 99. */
const span = (lvl: number) => { const l = Math.min(98, Math.max(1, lvl)); return OSRS_XP_TABLE[l + 1] - OSRS_XP_TABLE[l]; };
/** What a death can take from a skill at this level: experience past 99 buys nothing (no level 100), so a skill at 99
 *  has nothing at stake (second-pass check of 2026-11-14). */
const atStake = (lvl: number) => (lvl >= 99 ? 0 : span(lvl));
function deathLoss(skills: Record<string, { xp: number; lvl: number }>, share: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of FIGHTING_SKILLS) {
    const s = skills[k];
    out[k] = Math.max(0, Math.min(Math.floor(s.xp - OSRS_XP_TABLE[s.lvl]), Math.floor(share * atStake(s.lvl))));
  }
  return out;
}
const atRisk = (skills: Record<string, { lvl: number }>, share: number) => FIGHTING_SKILLS.reduce((n, k) => n + Math.floor(share * atStake(skills[k].lvl)), 0);
const vowPrice = (skills: Record<string, { lvl: number }>, share: number) => Math.max(VOW_FLOOR, Math.ceil(VOW_COINS_PER_XP * atRisk(skills, share)));

// self-check of the rule: never a level, a skill at 99 loses nothing, nothing below the level's floor
{
  const s = createDefaultState();
  for (const k of FIGHTING_SKILLS) { s.skills[k] = { xp: OSRS_XP_TABLE[99] + 5_000_000, lvl: 99 }; }
  s.skills.attack = { xp: OSRS_XP_TABLE[40] + 3, lvl: 40 };
  s.skills.magic = { xp: 0, lvl: 1 };
  const loss = deathLoss(s.skills, 0.03);
  for (const k of FIGHTING_SKILLS) {
    if (!Number.isFinite(loss[k]) || loss[k] < 0) throw new Error(`death rule: bad loss for ${k}`);
    if (getLevelForXp(s.skills[k].xp - loss[k]) !== s.skills[k].lvl) throw new Error(`death rule: ${k} dropped a level`);
  }
  if (loss.attack !== 3 || loss.magic !== 0 || loss.strength !== 0) throw new Error('death rule: wrong amounts');
}

// A melee hero in the controlled style (Stage 3's fighter, its design 4.2): Attack = Strength = Defence = L,
// Hitpoints from the same damage (1.5 against 1.4 per point, from 1,154), Ranged and Magic untrained, Prayer 1.
// The monster is the one Stage 3's model fights at that level; coins per kill are Stage 3's "after" figures
// (its design 4.4: coins plus dropped gear sold, no bounty).
const BANDS: { L: number; monster: string; gearSold: number }[] = [
  { L: 12, monster: 'scorpion', gearSold: 6 },
  { L: 20, monster: 'hill_giant', gearSold: 26 },
  { L: 30, monster: 'hill_giant', gearSold: 26 },
  { L: 40, monster: 'hill_giant', gearSold: 26 },
  { L: 50, monster: 'hill_giant', gearSold: 26 },
  { L: 60, monster: 'moss_guardian', gearSold: 80 },
  { L: 70, monster: 'lesser_demon', gearSold: 239 },
  { L: 80, monster: 'lesser_demon', gearSold: 239 },
  { L: 90, monster: 'lesser_demon', gearSold: 239 },
  { L: 99, monster: 'lesser_demon', gearSold: 239 }
];
const RATE: Record<string, number> = { attack: 1.4, strength: 1.3, defence: 1.3, hitpoints: 1.5 };
function hero(L: number) {
  const s = createDefaultState();
  const midXp = (lvl: number) => OSRS_XP_TABLE[lvl] + Math.floor(span(lvl) / 2); // halfway through the level
  for (const k of ['attack', 'strength', 'defence']) s.skills[k] = { xp: midXp(L), lvl: L };
  const hpXp = 1154 + (midXp(L) * 1.5) / 1.4, hpLvl = getLevelForXp(hpXp);
  s.skills.hitpoints = { xp: Math.floor(hpXp), lvl: hpLvl };
  return s;
}
const coinsPerKill = (typeKey: string) => {
  let c = 0;
  for (const d of MONSTER_TYPES[typeKey].drops as { gp?: [number, number]; chance: number }[]) if (d.gp) c += ((d.gp[0] + d.gp[1]) / 2) * d.chance;
  return c;
};
p('== 1. What a death costs: experience lost, in kills to earn it back, and the price of the blessing');
p(`   rule: each of ${FIGHTING_SKILLS.join(', ')} loses min(experience inside its level, share x the level's span); never a level; nothing at 99;`);
p(`   nothing below combat level ${NO_LOSS_BELOW_COMBAT}. Blessing: ${VOW_COINS_PER_XP} coin per point it guards (share x span, summed), at least ${VOW_FLOOR} coins.`);
p('   hero: melee, controlled style, Attack = Strength = Defence = L, halfway through each level; 1x experience.');
p('   "kills back" = kills of the same monster until the slowest skill has re-earned its loss; at the 10x rate divide by 10.');
p(' L  combat  monster         kills/level  coins/kill |  share 1%: xp lost  kills back  blessing (coins, kills of coin) |  share 3%:  xp lost  kills back  blessing        |  share 5%:  xp lost  kills back  blessing');
for (const b of BANDS) {
  const s = hero(b.L), m = MONSTER_TYPES[b.monster], coins = coinsPerKill(b.monster) + b.gearSold;
  const cl = combatLevel(s);
  const cells: string[] = [];
  for (const share of [0.01, 0.03, 0.05]) {
    const loss = cl < NO_LOSS_BELOW_COMBAT ? Object.fromEntries(FIGHTING_SKILLS.map((k) => [k, 0])) : deathLoss(s.skills, share);
    const total = Object.values(loss).reduce((a, n) => a + n, 0);
    const back = Math.max(...Object.keys(RATE).map((k) => loss[k] / (RATE[k] * m.hp)));
    const price = cl < NO_LOSS_BELOW_COMBAT ? 0 : vowPrice(s.skills, share);
    cells.push(`${String(total).padStart(9)} ${back.toFixed(1).padStart(10)} ${String(price).padStart(9)} (${(price / coins).toFixed(1).padStart(5)} kills)`);
  }
  const perLevel = span(b.L) / (RATE.strength * m.hp);
  p(`${String(b.L).padStart(2)} ${String(cl).padStart(6)}  ${b.monster.padEnd(14)} ${perLevel.toFixed(0).padStart(10)} ${coins.toFixed(0).padStart(11)} | ${cells.join(' | ')}`);
}
p('   as a gold sink (share 3%): one blessing costs this share of the coins the same hero earns while gaining one level:');
p('   ' + BANDS.filter((b) => b.L >= 20).map((b) => {
  const s = hero(b.L), m = MONSTER_TYPES[b.monster], coins = coinsPerKill(b.monster) + b.gearSold;
  return `L${b.L} ${((vowPrice(s.skills, 0.03) / ((span(b.L) / (RATE.strength * m.hp)) * coins)) * 100).toFixed(1)}%`;
}).join(', '));

// ---------------------------------------------------------------- 2. regeneration and the Stage 2 gate
// The frozen gate test has no regeneration at all. This reruns its crossing (same seeds, same runner) with
// hitpoints regenerating at a given rate from the first blow on, which is what the running game does.
p('\n== 2. The Stage 2 gate (Cinderstep Pass, 1000 seeds, three lines) with hitpoints regenerating during the run');
const sentryCamp = CAMPS.find((c) => c.id === 'pass_sentries')!;
function crossing(make: () => ReturnType<typeof createDefaultState>, lineZ: number, seed: number, regen: number): boolean {
  const rand = seeded(seed), state = make(), playerCombat = combatLevel(state), DT = 1 / 60;
  const sentries = sentryCamp.members.map((mem) => {
    const m = createMonsterLogic(mem.type, mem.x, mem.z, { campId: sentryCamp.id, wander: mem.wander });
    m.wanderTimer = rand() * 3;
    return m;
  });
  let hp = state.hp, px = -8;
  while (px > -80) {
    px = Math.max(-80, px - 11.5 * DT);
    if (hp < state.maxHp) hp = Math.min(state.maxHp, hp + regen * DT);
    const world = { playerX: px, playerZ: lineZ, playerDown: hp <= 0, dt: DT, rand, playerCombat, playerSafe: isInSafeZone(px, lineZ), camps: CAMPS };
    for (const m of sentries) for (const ev of stepMonster(m, world)) {
      if (ev.kind !== 'attack') continue;
      m.breathCount += 1;
      hp -= rollMonsterHit(m.typeKey, m.breathCount, state, rand).dmg;
    }
    if (hp <= 0) return false;
  }
  return true;
}
const fresh = () => createDefaultState();
const prayedForty = () => { const s = createDefaultState(); s.skills.hitpoints.lvl = 40; s.maxHp = 40; s.hp = 40; s.activePrayers.add('prot_melee'); return s; };
p('regeneration during the run     fresh character survives (must stay under 5%)   40 HP with Protect from Melee survives (must be 100%)');
for (const [label, regen] of [['none (the frozen test)', 0], ['0.25 HP/s (in combat, as today)', 0.25], ['1.0 HP/s (if the resting rate applied)', 1.0]] as [string, number][]) {
  const cells = [fresh, prayedForty].map((make) => [55, 52.5, 57.5].map((z) => {
    let n = 0;
    for (let seed = 1; seed <= 1000; seed++) if (crossing(make, z, seed, regen)) n++;
    return `${(n / 10).toFixed(1)}%`;
  }).join(' / '));
  p(`${label.padEnd(40)} ${cells[0].padEnd(40)} ${cells[1]}`);
}
// Second pass (2026-11-14): is the margin under 5% a property of the pass or of seeds 1 to 1000? Ten blocks of 1000.
p('   the fresh character over seeds 1 to 10000 (ten blocks of 1000 on each of the three lines):');
for (const regen of [0, 0.25]) {
  let alive = 0, runs = 0, worst = 0, worstAt = '';
  for (let b = 0; b < 10; b++) for (const z of [55, 52.5, 57.5]) {
    let n = 0;
    for (let seed = b * 1000 + 1; seed <= b * 1000 + 1000; seed++) if (crossing(fresh, z, seed, regen)) n++;
    alive += n; runs += 1000;
    if (n / 10 > worst) { worst = n / 10; worstAt = `seeds ${b * 1000 + 1}-${b * 1000 + 1000}, z ${z}`; }
  }
  p(`   ${(regen === 0 ? 'none (the frozen test)' : '0.25 HP/s (in combat, as today)').padEnd(34)} pooled ${((alive / runs) * 100).toFixed(2)}%   worst block ${worst.toFixed(1)}% (${worstAt})`);
}
p('   time to regenerate from 1 hitpoint to full while resting, by maximum hitpoints (0.25 HP/s today, 1.0 HP/s proposed):');
p('   ' + [10, 30, 50, 70, 99].map((hp) => `${hp} HP: ${((hp - 1) / 0.25).toFixed(0)} s -> ${((hp - 1) / 1.0).toFixed(0)} s`).join(', '));

// ---------------------------------------------------------------- 3. the new boss's arena
// Criterion (critique H-7, extended for a second dragon): the circle of arena radius + margin must be clear of
// every other camp's leash circle (radius + 4) and of every safe zone; the arena itself must be out of reach
// of every other camp's attacks (leash + the monsters' reach) and outside every aggression circle; every cell
// of the arena open and inside the world's bound; no path or point-of-interest pad inside arena + margin; no
// resource node inside the arena or within NODE_CLEAR of it (a gatherer there stands outside the boss's
// aggression circle, which has the arena's radius); and the arena's ground no steeper than MAX_STEP per unit
// (flat shapes are drawn on it; the ridge's foot, which is walkable, rises over 2.5 per unit).
const NODE_CLEAR = 2, MAX_STEP = 0.8;
p('\n== 3. Arena of the new boss');
const grid = buildWalkGrid();
const open = (x: number, z: number) => {
  const gx = Math.floor(x - grid.origin), gz = Math.floor(z - grid.origin);
  return gx >= 0 && gz >= 0 && gx < grid.size && gz < grid.size && grid.cells[gz * grid.size + gx] === 1;
};
const reachOf = (camp: (typeof CAMPS)[number]) => Math.max(...camp.members.map((m) => (MONSTER_TYPES[m.type].style === 'melee' ? 2.9 : 11)));
function assess(x: number, z: number) {
  const R = ARENA.radius, big = R + ARENA.margin;
  let leashGap = Infinity, reachGap = Infinity, aggroGap = Infinity, worst = '';
  for (const c of CAMPS) {
    if (c.id === BOSS_KEY) continue; // the boss's own camp, now in the live CAMPS, is not its neighbour
    const d = Math.hypot(c.x - x, c.z - z);
    const lg = d - (c.radius + 4) - big;
    if (lg < leashGap) { leashGap = lg; worst = c.id; }
    reachGap = Math.min(reachGap, d - (c.radius + 4 + reachOf(c)) - R);
    if (c.aggressive) aggroGap = Math.min(aggroGap, d - (c.aggroRadius || 0) - R);
  }
  const safeGap = Math.min(...SAFE_ZONES.map((s) => Math.hypot(s.x - x, s.z - z) - s.radius - big));
  let arenaCells = 0, arenaOpen = 0, bigCells = 0, bigOpen = 0;
  for (let gz = 0; gz < grid.size; gz++) for (let gx = 0; gx < grid.size; gx++) {
    const cx = grid.origin + gx + 0.5, cz = grid.origin + gz + 0.5, d = Math.hypot(cx - x, cz - z);
    if (d <= big) { bigCells++; if (grid.cells[gz * grid.size + gx]) bigOpen++; }
    if (d <= R) { arenaCells++; if (grid.cells[gz * grid.size + gx]) arenaOpen++; }
  }
  const nodeGap = Math.min(...NODE_PLACEMENTS.map((n) => Math.hypot(n.x - x, n.z - z))) - R - NODE_CLEAR;
  let lo = Infinity, hi = -Infinity, steep = 0;
  for (let dx = -R; dx <= R; dx += 0.5) for (let dz = -R; dz <= R; dz += 0.5) {
    if (Math.hypot(dx, dz) > R) continue;
    const h = getTerrainHeight(x + dx, z + dz);
    lo = Math.min(lo, h); hi = Math.max(hi, h);
    steep = Math.max(steep, Math.abs(getTerrainHeight(x + dx + 1, z + dz) - h), Math.abs(getTerrainHeight(x + dx, z + dz + 1) - h));
  }
  let pathGap = Infinity;
  for (const path of PATHS) for (let i = 1; i < path.points.length; i++) {
    const [ax, az] = path.points[i - 1], [bx, bz] = path.points[i];
    for (let k = 0; k <= 20; k++) pathGap = Math.min(pathGap, Math.hypot(ax + ((bx - ax) * k) / 20 - x, az + ((bz - az) * k) / 20 - z) - path.halfWidth - big);
  }
  const poiGap = Math.min(...POIS.map((q) => Math.hypot(q.x - x, q.z - z) - q.padRadius)) - big;
  const edgeGap = Math.min(118 - Math.abs(x), 118 - Math.abs(z)) - big; // negative: part of the margin lies past the world's bound
  return { leashGap, worst, reachGap, aggroGap, safeGap, arenaCells, arenaOpen, bigCells, bigOpen, nodeGap, pathGap, poiGap, edgeGap, rise: hi - lo, steep };
}
const passes = (a: ReturnType<typeof assess>) => a.edgeGap + ARENA.margin >= 0 && a.leashGap > 0 && a.reachGap > 0 && a.aggroGap > 0 && a.safeGap > 0 && a.arenaOpen === a.arenaCells && a.nodeGap > 0 && a.pathGap > 0 && a.poiGap > 0 && a.steep <= MAX_STEP;
function show(label: string, x: number, z: number) {
  const a = assess(x, z);
  p(`   ${label} (${x}, ${z}), arena ${ARENA.radius} + margin ${ARENA.margin}: ${passes(a) ? 'PASSES' : 'FAILS'}`);
  p(`      gap to the nearest leash circle ${a.leashGap.toFixed(1)} (${a.worst}); arena to the nearest camp's attack reach ${a.reachGap.toFixed(1)}; arena to the nearest aggression circle ${a.aggroGap.toFixed(1)}; gap to the nearest safe zone ${a.safeGap.toFixed(1)}`);
  p(`      arena cells open ${a.arenaOpen} of ${a.arenaCells}; arena + margin cells open ${a.bigOpen} of ${a.bigCells}; nearest resource node ${a.nodeGap.toFixed(1)} beyond arena + ${NODE_CLEAR}, nearest path ${a.pathGap.toFixed(1)} beyond the margin, nearest point of interest ${a.poiGap.toFixed(1)}; world bound ${a.edgeGap.toFixed(1)} from the margin`);
  p(`      ground inside the arena: rises ${a.rise.toFixed(1)} in all, steepest ${a.steep.toFixed(2)} per unit (limit ${MAX_STEP})`);
  return a;
}
const dragonCamp = CAMPS.find((c) => c.id === 'dragon')!;
p(`   the existing dragon stays at (${dragonCamp.x}, ${dragonCamp.z}) and counts as one of the other camps (magic, reach 11, aggression radius ${dragonCamp.aggroRadius})`);
show('first draft', -106, 106);
show('critique', -106, 66);
show('first pick of this revision', -100, 50);
show('chosen', ARENA.x, ARENA.z);
if (!passes(assess(ARENA.x, ARENA.z))) throw new Error('arena: the chosen spot fails the criterion');
{
  // every spot on a 2-unit lattice west of the pass that passes, best first by the smallest gap
  const found: { x: number; z: number; min: number; a: ReturnType<typeof assess> }[] = [];
  for (let x = -116; x <= -40; x += 2) for (let z = 20; z <= 116; z += 2) {
    const a = assess(x, z);
    if (passes(a)) found.push({ x, z, a, min: Math.min(a.leashGap, a.reachGap, a.safeGap, a.nodeGap, a.pathGap, a.poiGap, a.edgeGap + ARENA.margin) });
  }
  found.sort((u, v) => v.min - u.min);
  p(`   spots on a 2-unit lattice (x -116..-40, z 20..116) that pass: ${found.length}; the eight with the widest smallest gap:`);
  for (const f of found.slice(0, 8)) p(`      (${f.x}, ${f.z}) smallest gap ${f.min.toFixed(1)}, steepest ${f.a.steep.toFixed(2)}, rise ${f.a.rise.toFixed(1)}, margin cells open ${f.a.bigOpen} of ${f.a.bigCells}, world bound ${f.a.edgeGap.toFixed(1)}`);
}
{
  // the walk: from the west mouth of Cinderstep Pass to the arena, and from the arena to the existing lair
  const stats = { expanded: 0 };
  const toArena = findPath(grid, [-48, 55], [ARENA.x, ARENA.z], stats);
  const toLair = findPath(grid, [ARENA.x, ARENA.z], [dragonCamp.x, dragonCamp.z], stats);
  const len = (path: [number, number][] | null, from: [number, number]) => (path ? [from, ...path].reduce((n, q, i, all) => n + (i ? Math.hypot(q[0] - all[i - 1][0], q[1] - all[i - 1][1]) : 0), 0).toFixed(0) : 'none');
  p(`   route from the pass's west mouth (-48, 55) to the arena: ${len(toArena, [-48, 55])} units; from the arena to the existing lair: ${len(toLair, [ARENA.x, ARENA.z])} units; arena centre open: ${open(ARENA.x, ARENA.z)}`);
}
