// Stage 4 combat model (design docs/superpowers/specs/2026-11-14-combat-weight-design.md): timing rule,
// conservation for ordinary monsters, share of wind-ups cleared, path cost. The boss fight is fight.ts and check.ts;
// the death rule, the gate with regeneration and the arena are decisions.ts.
// Imports the game's real tables and pure functions.
// Seeded: the same run prints the same numbers. Run with run.sh.
import { MONSTER_TYPES } from '../../../../src/data/world';
import { CAMPS } from '../../../../src/data/worldMap';
import { ITEMS } from '../../../../src/data/items';
import { getEquipmentBonuses, rollMonsterHit } from '../../../../src/state/combat';
import { createDefaultState } from '../../../../src/state/gameState';
import { buildWalkGrid, findPath } from '../../../../src/state/pathfind';
import type { GameState } from '../../../../src/state/types';
import { BOSS, BOSS_ATTACKS, type Attack, type Shape } from './boss';

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
const p = (...a: unknown[]) => console.log(...a);

// ---------------------------------------------------------------- 1. proposed data (design 6.2, 6.4)
const CADENCE = 1.65; // monsterAi ATTACK_INTERVAL
const RUN = 11.5; // loop.ts moveSpeed
const HUMAN_MS = 700; // see 250 + decide 150 + click 300
const DEVICE_MS = 160; // two frames at 12.5 FPS (dt cap 0.08)
const ACCEL_MS = 90; // accelRate 16: about 63% of speed after 62 ms
const MARGIN_MS = 200;

const BODY = 0.3;

/** Worst distance a target inside the shape must travel to leave it. */
function escapeDistance(a: Attack): number {
  const s = a.shape;
  // A self-anchored circle: the target can stand right against the monster (critique M4), so the worst case is the radius.
  if (s.type === 'circle') return s.radius + BODY;
  if (s.type === 'line') return s.halfWidth + BODY;
  if (s.type === 'ring') return Math.max(0, Math.min(a.reach, s.outer) - s.inner) + BODY;
  // cone: sideways d*sin(theta), or forward out of the end, whichever is shorter; worst over d <= reach
  let worst = 0;
  const sin = Math.sin((s.halfAngleDeg * Math.PI) / 180);
  for (let d = 0.5; d <= Math.min(a.reach, s.length); d += 0.05) worst = Math.max(worst, Math.min(d * sin, s.length - d));
  return worst + BODY;
}
function minWindupMs(a: Attack): number {
  return HUMAN_MS + DEVICE_MS + ACCEL_MS + (escapeDistance(a) / RUN) * 1000;
}

const ATTACKS: Record<string, Attack> = {
  // ordinary monsters: conservation rule, damage = slots x one basic roll, the hit is rolled as today
  tail_lash:      { id: 'tail_lash',      shape: { type: 'cone', length: 4.5, halfAngleDeg: 40 },        windupMs: 1600, slots: 2, style: 'own', reach: 2.9 },
  hex_circle:     { id: 'hex_circle',     shape: { type: 'circle', anchor: 'target', radius: 2.5 },      windupMs: 1600, slots: 2, style: 'own', reach: 11 },
  pinning_volley: { id: 'pinning_volley', shape: { type: 'circle', anchor: 'target', radius: 2.5 },      windupMs: 1600, slots: 2, style: 'own', reach: 11 },
  overhead_slam:  { id: 'overhead_slam',  shape: { type: 'circle', anchor: 'target', radius: 3.0 },      windupMs: 1600, slots: 2, style: 'own', reach: 2.9 },
  ground_quake:   { id: 'ground_quake',   shape: { type: 'circle', anchor: 'self', radius: 4.5 },        windupMs: 1700, slots: 2, style: 'own', reach: 2.9 },
  scorch_line:    { id: 'scorch_line',    shape: { type: 'line', length: 12, halfWidth: 1.2 },           windupMs: 1600, slots: 2, style: 'own', reach: 2.9 },
  // the new boss (boss.ts, shared with the positional fight): sure damage when inside, by power
  ...BOSS_ATTACKS
};
const PATTERNS: Record<string, string[]> = {
  scorpion: ['basic', 'basic', 'basic', 'tail_lash'],
  dark_wizard: ['basic', 'basic', 'basic', 'hex_circle'],
  dark_ranger: ['basic', 'basic', 'basic', 'pinning_volley'],
  hill_giant: ['basic', 'basic', 'basic', 'overhead_slam'],
  moss_guardian: ['basic', 'basic', 'basic', 'ground_quake'],
  lesser_demon: ['basic', 'basic', 'basic', 'scorch_line']
};
// ---------------------------------------------------------------- 2. timing table
p('== 1. Timing table: wind-up against the minimum for a click-to-act answer');
p(`   minimum = human ${HUMAN_MS} + device ${DEVICE_MS} + accel ${ACCEL_MS} + escape distance / ${RUN} u/s; required margin ${MARGIN_MS} ms`);
p('attack           shape                        escape(u)  min(ms)  windup(ms)  margin(ms)  slots  recovery(ms)');
let timingOk = true;
for (const a of Object.values(ATTACKS)) {
  const esc = escapeDistance(a);
  const min = minWindupMs(a);
  const margin = a.windupMs - min;
  if (margin < MARGIN_MS) timingOk = false;
  const s = a.shape;
  const desc = s.type === 'circle' ? `circle r${s.radius} at ${s.anchor}` : s.type === 'cone' ? `cone ${s.length} x ${s.halfAngleDeg}deg` : s.type === 'line' ? `line ${s.length} x ${s.halfWidth * 2}` : `ring ${s.inner}..${s.outer}`;
  p(`${a.id.padEnd(16)} ${desc.padEnd(28)} ${esc.toFixed(2).padStart(8)} ${min.toFixed(0).padStart(8)} ${String(a.windupMs).padStart(10)} ${margin.toFixed(0).padStart(11)} ${String(a.slots).padStart(6)} ${(a.slots * CADENCE * 1000 - a.windupMs).toFixed(0).padStart(12)}`);
}
p(`   every row has at least ${MARGIN_MS} ms of margin: ${timingOk}`);
{
  // the boss's last phase shortens slots, never wind-ups: slot = max(slots x cadence x mult, wind-up + 150 ms)
  const mult = BOSS.phases[BOSS.phases.length - 1].cadenceMult;
  const rows = [...new Set(BOSS.phases[BOSS.phases.length - 1].pattern)].filter((id) => id !== 'basic').map((id) => {
    const a = ATTACKS[id], slot = Math.max(a.slots * CADENCE * mult * 1000, a.windupMs + 150);
    return `${id} slot ${slot.toFixed(0)} recovery ${(slot - a.windupMs).toFixed(0)}`;
  });
  p(`   boss phase III (cadence x${mult}), in ms: ${rows.join('; ')}`);
}

// ---------------------------------------------------------------- 3. player attack (transcribed, actions.ts 98-121, 179-182)
function profile(o: { lvl: number; hp: number; prayer: number; gear: Record<string, string>; prayers?: string[] }): GameState {
  const s = createDefaultState();
  for (const k of ['attack', 'strength', 'defence']) s.skills[k].lvl = o.lvl;
  s.skills.hitpoints.lvl = o.hp; s.maxHp = o.hp; s.hp = o.hp;
  s.skills.prayer.lvl = o.prayer; s.maxPrayerPts = o.prayer; s.prayerPts = o.prayer;
  for (const slot of Object.keys(s.equipment)) s.equipment[slot] = null;
  for (const [slot, id] of Object.entries(o.gear)) {
    if (!Object.hasOwn(ITEMS, id)) throw new Error(`model: unknown item ${id}`);
    s.equipment[slot] = id;
  }
  s.combatStyle = 'controlled';
  s.activePrayers = new Set(o.prayers || []);
  return s;
}
// ---------------------------------------------------------------- 4. conservation rule for ordinary monsters
p('\n== 2. Ordinary monsters: damage per second against a player who never reacts (10,000 s each, seed 7)');
p('   rule: a heavy attack takes `slots` slots of the cadence and deals `slots` x one basic roll');
p('monster          today dps   with pattern, standing   dodging every heavy   share avoidable');
const fighter30 = () => profile({ lvl: 30, hp: 30, prayer: 1, gear: { weapon: 'addy_scimitar', body: 'addy_plate', legs: 'addy_legs' } });
for (const typeKey of Object.keys(PATTERNS)) {
  const state = fighter30();
  const rand = seeded(7);
  const T = 10000;
  let today = 0;
  for (let t = 0; t < T; t += CADENCE) today += rollMonsterHit(typeKey, 1, state, rand).dmg;
  let stand = 0, dodge = 0, t = 0, i = 0;
  const pat = PATTERNS[typeKey];
  while (t < T) {
    const id = pat[i++ % pat.length];
    if (id === 'basic') { const d = rollMonsterHit(typeKey, 1, state, rand).dmg; stand += d; dodge += d; t += CADENCE; }
    else { const a = ATTACKS[id]; stand += a.slots * rollMonsterHit(typeKey, 1, state, rand).dmg; t += a.slots * CADENCE; }
  }
  p(`${typeKey.padEnd(16)} ${(today / T).toFixed(3).padStart(9)} ${(stand / T).toFixed(3).padStart(24)} ${(dodge / T).toFixed(3).padStart(21)} ${((1 - dodge / stand) * 100).toFixed(0).padStart(16)}%`);
}

// (5. The position-free boss fight of the first draft was cut in the revision of 2026-11-14: the critique showed it
// hides the geometry that decides who wins. The boss fight is fight.ts, printed by check.ts.)
function lognormal(rand: () => number, median: number, sigma: number): number {
  const u = Math.max(1e-9, rand()), v = rand();
  return median * Math.exp(sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
}

// ---------------------------------------------------------------- 6. reaction: share of attentive players who clear each wind-up
p('\n== 3. Share of wind-ups cleared, by player speed (human time lognormal, median 550 ms, sigma 0.3; 5% not noticed)');
p('attack            fast device   slow device (+160 ms more)   slow player (+300 ms)');
for (const a of Object.values(ATTACKS)) {
  const row = [0, 160, 300].map((extra) => {
    const rand = seeded(11); let ok = 0; const N = 20000;
    for (let i = 0; i < N; i++) if (rand() > 0.05 && DEVICE_MS + extra + lognormal(rand, 550, 0.3) + ACCEL_MS + (escapeDistance(a) / RUN) * 1000 <= a.windupMs) ok++;
    return ((ok / N) * 100).toFixed(1) + '%';
  });
  p(`${a.id.padEnd(17)} ${row[0].padStart(11)} ${row[1].padStart(20)} ${row[2].padStart(24)}`);
}

// ---------------------------------------------------------------- 7. pathing cost on the real walk grid
p('\n== 4. Monster pathing on the Stage 2 walk grid (real buildWalkGrid and findPath)');
const grid = buildWalkGrid();
const CAP = 6000; // design 6.1 search cap
let closedHomes = 0, calls = 0, nulls = 0, maxExp = 0, sumExp = 0, overCap = 0;
const t0 = performance.now();
for (const camp of CAMPS) for (const mem of camp.members) {
  const gx = Math.floor(mem.x - grid.origin), gz = Math.floor(mem.z - grid.origin);
  if (grid.cells[gz * grid.size + gx] !== 1) { closedHomes++; p(`   home cell closed: ${camp.id} ${mem.type} (${mem.x}, ${mem.z})`); continue; }
  for (const R of [camp.radius + 4, camp.radius + 4 + 11]) for (let k = 0; k < 16; k++) {
    const ang = (k / 16) * Math.PI * 2;
    const from: [number, number] = [camp.x + Math.cos(ang) * R, camp.z + Math.sin(ang) * R];
    const fx = Math.floor(from[0] - grid.origin), fz = Math.floor(from[1] - grid.origin);
    if (fx < 0 || fz < 0 || fx >= grid.size || fz >= grid.size || grid.cells[fz * grid.size + fx] !== 1) continue;
    const stats = { expanded: 0 };
    const path = findPath(grid, from, [mem.x, mem.z], stats);
    calls++; sumExp += stats.expanded; maxExp = Math.max(maxExp, stats.expanded);
    if (stats.expanded > CAP) overCap++;
    if (!path) nulls++;
  }
}
const ms = performance.now() - t0;
p(`   monsters: ${CAMPS.reduce((n, c) => n + c.members.length, 0)}; home cells closed on the grid: ${closedHomes}`);
p(`   findPath calls (to each home from 32 points at leash and leash + 11): ${calls}; no route: ${nulls}`);
p(`   expanded cells: mean ${(sumExp / calls).toFixed(0)}, max ${maxExp}; calls over the cap of ${CAP}: ${overCap}`);
p(`   time: ${(ms / calls).toFixed(3)} ms per call as written today (each call allocates and fills four ${grid.size * grid.size}-cell arrays)`);
// (The arena check moved to decisions.ts: the existing dragon stays where it is and the new boss has its own arena.)
