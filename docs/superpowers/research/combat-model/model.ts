// Stage 4 combat model (design docs/superpowers/specs/2026-11-14-combat-weight-design.md).
// Imports the game's real tables and pure functions; the player's attack arithmetic is transcribed
// from src/engine/actions.ts (performPlayerAttack), which is engine code and cannot be imported.
// Seeded: the same run prints the same numbers. Run with run.sh.
import { MONSTER_TYPES } from '../../../../src/data/world';
import { CAMPS } from '../../../../src/data/worldMap';
import { ITEMS } from '../../../../src/data/items';
import { getEquipmentBonuses, rollMonsterHit } from '../../../../src/state/combat';
import { combatLevel, resolveDragonfire } from '../../../../src/state/adventure';
import { createDefaultState } from '../../../../src/state/gameState';
import { buildWalkGrid, findPath } from '../../../../src/state/pathfind';
import type { GameState } from '../../../../src/state/types';

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

type Shape =
  | { type: 'circle'; anchor: 'target' | 'self'; radius: number }
  | { type: 'cone'; length: number; halfAngleDeg: number }
  | { type: 'line'; length: number; halfWidth: number }
  | { type: 'ring'; inner: number; outer: number };
type Attack = {
  id: string; shape: Shape; windupMs: number; slots: number;
  style: 'melee' | 'ranged' | 'magic' | 'fire' | 'pure' | 'own';
  power?: number; // bosses: sure damage power x (0.75..1.0) when inside the shape
  reach: number; // farthest the target stands from the monster when the shape locks
};
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
  // the boss: sure damage when inside, by power; styles differ so that no single prayer covers the fight
  ember_cone:     { id: 'ember_cone',     shape: { type: 'cone', length: 12, halfAngleDeg: 32 },         windupMs: 1800, slots: 2, style: 'fire',  power: 50, reach: 11 },
  tail_sweep:     { id: 'tail_sweep',     shape: { type: 'circle', anchor: 'self', radius: 5.0 },        windupMs: 1700, slots: 2, style: 'melee', power: 46, reach: 5 },
  cinder_fall:    { id: 'cinder_fall',    shape: { type: 'circle', anchor: 'target', radius: 2.5 },      windupMs: 1500, slots: 1, style: 'fire',  power: 30, reach: 11 },
  ashen_nova:     { id: 'ashen_nova',     shape: { type: 'ring', inner: 4.0, outer: 14 },                windupMs: 2400, slots: 2, style: 'pure',  power: 60, reach: 13.5 }
};
const PATTERNS: Record<string, string[]> = {
  scorpion: ['basic', 'basic', 'basic', 'tail_lash'],
  dark_wizard: ['basic', 'basic', 'basic', 'hex_circle'],
  dark_ranger: ['basic', 'basic', 'basic', 'pinning_volley'],
  hill_giant: ['basic', 'basic', 'basic', 'overhead_slam'],
  moss_guardian: ['basic', 'basic', 'basic', 'ground_quake'],
  lesser_demon: ['basic', 'basic', 'basic', 'scorch_line']
};
type Phase = { name: string; untilHpFrac: number; pattern: string[]; cadenceMult: number; shiftMs: number };
const BOSS = {
  typeKey: 'elvarg_dragon',
  hp: Number(process.env.BOSS_HP || 1200),
  respawnSecs: 120,
  phases: [
    { name: 'I Grounded', untilHpFrac: 0.66, pattern: ['basic', 'basic', 'ember_cone', 'basic', 'tail_sweep'], cadenceMult: 1, shiftMs: 0 },
    { name: 'II Cinders', untilHpFrac: 0.33, pattern: ['basic', 'cinder_fall', 'cinder_fall', 'cinder_fall', 'tail_sweep', 'basic', 'ember_cone'], cadenceMult: 1, shiftMs: 2000 },
    { name: 'III Fury', untilHpFrac: 0, pattern: ['basic', 'ember_cone', 'ashen_nova', 'basic', 'tail_sweep', 'cinder_fall', 'cinder_fall'], cadenceMult: 0.8, shiftMs: 2000 }
  ] as Phase[]
};
/** A heavy attack's whole slot: its share of the cadence, never shorter than wind-up + 150 ms (one wind-up at a time). */
function heavySlotSecs(a: Attack, cadenceMult: number): number {
  return Math.max(a.slots * CADENCE * cadenceMult, a.windupMs / 1000 + 0.15);
}
const EAT_CD = 1.8;
// Boss only: each heavy hit taken leaves a mark for MARK_SECS; every mark adds MARK_STEP to the next heavy hit.
const MARK_STEP = Number(process.env.MARK_STEP || 0.25), MARK_MAX = 4, MARK_SECS = 12;
const TICK = 0.6;

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
function playerSwing(s: GameState, typeKey: string): { maxHit: number; hitChance: number; avg: number } {
  const bon = getEquipmentBonuses(s);
  const maxHit = Math.max(2, Math.floor(1.5 + (s.skills.strength.lvl + 1) * 0.32 + bon.str * 0.22));
  const acc = (s.skills.attack.lvl + 2) * 1.35 + bon.atk + 12;
  const defRoll = MONSTER_TYPES[typeKey].def * 1.1 + 4;
  const hitChance = Math.min(0.94, Math.max(0.22, acc / (acc + defRoll * 0.75)));
  const avgOnHit = (1 + (maxHit * (maxHit + 1)) / 2) / (maxHit + 1);
  return { maxHit, hitChance, avg: hitChance * avgOnHit };
}
function rollSwing(s: GameState, typeKey: string, rand: () => number): number {
  const sw = playerSwing(s, typeKey);
  return rand() < sw.hitChance ? Math.max(1, Math.floor(rand() * (sw.maxHit + 1))) : 0;
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

// ---------------------------------------------------------------- 5. boss fight
type Fighter = {
  name: string; make: () => GameState; food: number; heal: number; potions: number;
  reacts: boolean; extraReactMs: number; ward: boolean;
};
function lognormal(rand: () => number, median: number, sigma: number): number {
  const u = Math.max(1e-9, rand()), v = rand();
  return median * Math.exp(sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
}
function fight(f: Fighter, seed: number): { win: boolean; secs: number; eaten: number; dodged: number; taken: number; heavies: number } {
  const rand = seeded(seed);
  const s = f.make();
  const boss = BOSS;
  let bossHp = boss.hp, phase = 0, idx = 0;
  let t = 0, nextSlot = 0, eatCd = 0, potCd = 0, atkCd = 0, away = 0, shift = 0;
  let food = f.food, potions = f.potions, eaten = 0, dodged = 0, taken = 0, heavies = 0;
  let pending: { at: number; a: Attack; dodge: boolean }[] = [];
  let marks = 0, markT = 0;
  const dt = 0.05;
  const hurt = (d: number) => { s.hp -= d; taken += d; };
  while (t < 600) {
    t += dt; markT -= dt; if (markT <= 0) marks = 0; eatCd -= dt; potCd -= dt; atkCd -= dt; away -= dt;
    // prayer drain (catalog PRAYERS: protect 0.35/s)
    if (s.activePrayers.size) { s.prayerPts -= 0.35 * dt; if (s.prayerPts <= 0) s.activePrayers.clear(); }
    if (potions > 0 && potCd <= 0 && s.skills.prayer.lvl >= 25 && s.prayerPts < 6) { potions--; potCd = EAT_CD; s.prayerPts = Math.min(s.maxPrayerPts, s.prayerPts + 18); s.activePrayers.add('prot_magic'); }
    // phase shift: boss is immune and does not attack
    if (shift > 0) { shift -= dt; nextSlot = t + 1.0; }
    else {
      // boss attack slots
      if (t >= nextSlot) {
        const ph = boss.phases[phase];
        const id = ph.pattern[idx++ % ph.pattern.length];
        if (id === 'basic') { hurt(rollMonsterHit(boss.typeKey, 1, s, rand).dmg); nextSlot = t + CADENCE * ph.cadenceMult; }
        else {
          const a = ATTACKS[id];
          heavies++;
          let dodge = false;
          if (f.reacts && rand() > 0.05) {
            const react = DEVICE_MS + f.extraReactMs + lognormal(rand, 550, 0.3) + ACCEL_MS + (escapeDistance(a) / RUN) * 1000;
            dodge = react <= a.windupMs;
          }
          pending.push({ at: t + a.windupMs / 1000, a, dodge });
          if (dodge) { away = Math.max(away, a.windupMs / 1000 + escapeDistance(a) / RUN + 0.2); }
          nextSlot = t + heavySlotSecs(a, ph.cadenceMult);
        }
      }
    }
    for (const h of pending) if (t >= h.at) {
      if (h.dodge) dodged++;
      else {
        let d = Math.floor(h.a.power! * (0.75 + 0.25 * rand()) * (1 + MARK_STEP * marks));
        marks = Math.min(MARK_MAX, marks + 1); markT = MARK_SECS;
        if (h.a.style === 'fire') d = (f.ward || s.activePrayers.has('prot_magic')) ? Math.floor(d * 0.25) : resolveDragonfire(d, s).damage;
        else if (h.a.style === 'melee' && s.activePrayers.has('prot_melee')) d = Math.floor(d * 0.2);
        hurt(d);
      }
    }
    pending = pending.filter((h) => t < h.at);
    if (s.hp <= 0) return { win: false, secs: t, eaten, dodged, taken, heavies };
    // player: eat, then swing
    const missing = s.maxHp - s.hp;
    if (food > 0 && eatCd <= 0 && (missing >= f.heal || s.hp <= s.maxHp * 0.5)) { food--; eaten++; eatCd = EAT_CD; atkCd = Math.max(atkCd, 0) + TICK; s.hp = Math.min(s.maxHp, s.hp + f.heal); }
    if (atkCd <= 0 && away <= 0 && shift <= 0) {
      atkCd = TICK;
      const floor = Math.ceil(boss.hp * boss.phases[phase].untilHpFrac);
      bossHp = Math.max(floor, bossHp - rollSwing(s, boss.typeKey, rand)); // phase gate: overflow is lost
      if (bossHp <= 0) return { win: true, secs: t, eaten, dodged, taken, heavies };
      if (bossHp <= floor && phase < boss.phases.length - 1) { phase++; idx = 0; shift = boss.phases[phase].shiftMs / 1000; pending = []; }
    }
  }
  return { win: false, secs: t, eaten, dodged, taken, heavies };
}
const dragonKit = { weapon: 'dragon_scimitar', body: 'dragon_chain', legs: 'dragon_legs', shield: 'dragon_defender' };
const runeKit = { weapon: 'rune_scimitar', body: 'rune_plate', legs: 'rune_legs', shield: 'rune_shield' };
const FIGHTERS: Fighter[] = [
  { name: 'A prepared, reacts',             make: () => profile({ lvl: 70, hp: 70, prayer: 45, gear: dragonKit, prayers: ['prot_magic'] }), food: 20, heal: 24, potions: 4, reacts: true,  extraReactMs: 0,   ward: true },
  { name: 'B prepared, never moves',        make: () => profile({ lvl: 70, hp: 70, prayer: 45, gear: dragonKit, prayers: ['prot_magic'] }), food: 20, heal: 24, potions: 4, reacts: false, extraReactMs: 0,   ward: true },
  { name: 'C prepared, slow (+300 ms)',     make: () => profile({ lvl: 70, hp: 70, prayer: 45, gear: dragonKit, prayers: ['prot_magic'] }), food: 20, heal: 24, potions: 4, reacts: true,  extraReactMs: 300, ward: true },
  { name: 'D prepared, no food',            make: () => profile({ lvl: 70, hp: 70, prayer: 45, gear: dragonKit, prayers: ['prot_magic'] }), food: 0,  heal: 24, potions: 4, reacts: true,  extraReactMs: 0,   ward: true },
  { name: 'E level 60, dragon kit, reacts', make: () => profile({ lvl: 60, hp: 60, prayer: 43, gear: dragonKit, prayers: ['prot_magic'] }), food: 16, heal: 24, potions: 3, reacts: true,  extraReactMs: 0,   ward: true },
  { name: 'F level 50 rune, no ward/prayer',make: () => profile({ lvl: 50, hp: 50, prayer: 20, gear: runeKit }),                           food: 10, heal: 16, potions: 0, reacts: true,  extraReactMs: 0,   ward: false },
  { name: 'G level 50 rune, never moves',   make: () => profile({ lvl: 50, hp: 50, prayer: 20, gear: runeKit }),                           food: 10, heal: 16, potions: 0, reacts: false, extraReactMs: 0,   ward: false }
];
p(`\n== 3. Boss fight: ${MONSTER_TYPES[BOSS.typeKey].name}, proposed HP ${BOSS.hp} (today ${MONSTER_TYPES[BOSS.typeKey].hp}), 2000 seeded fights each`);
p('   food cooldown 1.8 s, eating delays the next swing by one 0.6 s tick, no hitpoint regeneration in combat');
p('fighter                           combat  swing(max, hit%)   win%   mean secs  food eaten  heavies dodged  damage taken');
for (const f of FIGHTERS) {
  const N = 2000;
  let wins = 0, secs = 0, eaten = 0, dodged = 0, heavies = 0, taken = 0;
  for (let i = 1; i <= N; i++) { const r = fight(f, i); if (r.win) wins++; secs += r.secs; eaten += r.eaten; dodged += r.dodged; heavies += r.heavies; taken += r.taken; }
  const s = f.make(); const sw = playerSwing(s, BOSS.typeKey);
  p(`${f.name.padEnd(33)} ${String(combatLevel(s)).padStart(6)}  ${(`${sw.maxHit}, ${(sw.hitChance * 100).toFixed(0)}%`).padStart(15)} ${((wins / N) * 100).toFixed(1).padStart(7)} ${(secs / N).toFixed(0).padStart(10)} ${(eaten / N).toFixed(1).padStart(11)} ${((dodged / Math.max(1, heavies)) * 100).toFixed(0).padStart(14)}% ${(taken / N).toFixed(0).padStart(13)}`);
}
{
  const s = FIGHTERS[0].make(); const sw = playerSwing(s, BOSS.typeKey);
  p(`   for scale: fighter A deals ${(sw.avg / TICK).toFixed(1)} damage per second when it only swings; today's ${MONSTER_TYPES[BOSS.typeKey].hp} HP last ${(MONSTER_TYPES[BOSS.typeKey].hp / (sw.avg / TICK)).toFixed(0)} s`);
}

// ---------------------------------------------------------------- 6. reaction: share of attentive players who clear each wind-up
p('\n== 4. Share of wind-ups cleared, by player speed (human time lognormal, median 550 ms, sigma 0.3; 5% not noticed)');
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
p('\n== 5. Monster pathing on the Stage 2 walk grid (real buildWalkGrid and findPath)');
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
const lair = CAMPS.find((c) => c.id === 'dragon')!;
for (const R of [10, 12, 14, 16]) {
  let open = 0, all = 0;
  for (let gz = 0; gz < grid.size; gz++) for (let gx = 0; gx < grid.size; gx++) {
    const cx = grid.origin + gx + 0.5, cz = grid.origin + gz + 0.5;
    if (Math.hypot(cx - lair.x, cz - lair.z) <= R) { all++; if (grid.cells[gz * grid.size + gx]) open++; }
  }
  const near = CAMPS.filter((c) => c.id !== 'dragon').map((c) => ({ id: c.id, gap: Math.hypot(c.x - lair.x, c.z - lair.z) - c.radius - R })).sort((a, b) => a.gap - b.gap)[0];
  p(`   lair (${lair.x}, ${lair.z}) arena radius ${R}: ${open} of ${all} cells open; nearest camp ${near.id}, gap ${near.gap.toFixed(1)}`);
}
