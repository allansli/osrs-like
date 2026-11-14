// Positional check of the boss fight (Stage 4 critique, 2026-11-14). Written independently of model.ts:
// the hero has a position, shapes are tested geometrically at the resolve, the hero keeps swinging until it
// reacts, and after a dodge it clicks the boss again (or waits for auto-retaliation) and walks back to reach.
import { MONSTER_TYPES } from '../../../../src/data/world';
import { ITEMS } from '../../../../src/data/items';
import { getEquipmentBonuses, rollMonsterHit } from '../../../../src/state/combat';
import { resolveDragonfire } from '../../../../src/state/adventure';
import { createDefaultState } from '../../../../src/state/gameState';
import type { GameState } from '../../../../src/state/types';

function seeded(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const lognormal = (r: () => number, med: number, sg: number) =>
  med * Math.exp(sg * Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r()));

type Shape =
  | { t: 'self'; r: number }
  | { t: 'target'; r: number }
  | { t: 'cone'; L: number; half: number }
  | { t: 'ring'; i: number; o: number };
type Atk = { shape: Shape; windup: number; slots: number; style: 'fire' | 'melee' | 'pure'; power: number };
const A: Record<string, Atk> = {
  ember_cone: { shape: { t: 'cone', L: 12, half: (32 * Math.PI) / 180 }, windup: 1.8, slots: 2, style: 'fire', power: 50 },
  tail_sweep: { shape: { t: 'self', r: 5 }, windup: 1.7, slots: 2, style: 'melee', power: 46 },
  cinder_fall: { shape: { t: 'target', r: 2.5 }, windup: 1.5, slots: 1, style: 'fire', power: 30 },
  ashen_nova: { shape: { t: 'ring', i: 4, o: 14 }, windup: 2.4, slots: 2, style: 'pure', power: 60 }
};
const PH = [
  { until: 0.66, pat: ['basic', 'basic', 'ember_cone', 'basic', 'tail_sweep'], mult: 1 },
  { until: 0.33, pat: ['basic', 'cinder_fall', 'cinder_fall', 'cinder_fall', 'tail_sweep', 'basic', 'ember_cone'], mult: 1 },
  { until: 0, pat: ['basic', 'ember_cone', 'ashen_nova', 'basic', 'tail_sweep', 'cinder_fall', 'cinder_fall'], mult: 0.8 }
];
const CAD = 1.65, TICK = 0.6, RUN = 11.5, BODY = 0.3, MELEE = 2.9, EAT_CD = 1.8;

type V = { x: number; z: number };
type Locked = { a: Atk; ox: number; oz: number; dx: number; dz: number; at: number };
function inside(l: Locked, p: V): boolean {
  const s = l.a.shape;
  const rx = p.x - l.ox, rz = p.z - l.oz, d = Math.hypot(rx, rz);
  if (s.t === 'self' || s.t === 'target') return d <= s.r;
  if (s.t === 'ring') return d >= s.i && d <= s.o;
  if (d > s.L) return false;
  if (d < 1e-9) return true;
  return Math.acos(Math.max(-1, Math.min(1, (rx * l.dx + rz * l.dz) / d))) <= s.half;
}
/** Shortest way out for a point inside: [distance, destination]. */
function escape(l: Locked, p: V): [number, V] {
  const s = l.a.shape;
  const rx = p.x - l.ox, rz = p.z - l.oz, d = Math.hypot(rx, rz) || 1e-6;
  const ux = rx / d, uz = rz / d;
  if (s.t === 'self') { const k = s.r - d + BODY; return [k, { x: p.x + ux * k, z: p.z + uz * k }]; }
  if (s.t === 'target') {
    // step sideways around the boss (keeps the walk back short)
    const k = s.r - d + BODY; const tx = -p.z, tz = p.x, tl = Math.hypot(tx, tz) || 1;
    const q = { x: l.ox + (tx / tl) * (s.r + BODY), z: l.oz + (tz / tl) * (s.r + BODY) };
    return [Math.hypot(q.x - p.x, q.z - p.z) || k, q];
  }
  if (s.t === 'ring') {
    const inn = d - s.i + BODY, out = s.o - d + BODY;
    if (inn <= out) return [inn, { x: p.x - ux * inn, z: p.z - uz * inn }];
    return [out, { x: p.x + ux * out, z: p.z + uz * out }];
  }
  // cone: sideways to the nearer edge, or out of the far end
  const cos = (rx * l.dx + rz * l.dz) / d, phi = Math.acos(Math.max(-1, Math.min(1, cos)));
  const side = d * Math.sin(s.half - phi) + BODY, fwd = s.L - d + BODY;
  if (fwd < side) return [fwd, { x: p.x + ux * fwd, z: p.z + uz * fwd }];
  const sgn = (l.dx * rz - l.dz * rx) >= 0 ? 1 : -1; // perpendicular away from the axis
  const px = -l.dz * sgn, pz = l.dx * sgn;
  return [side, { x: p.x + px * side, z: p.z + pz * side }];
}

function profile(lvl: number, hp: number, prayer: number, gear: Record<string, string>, prayers: string[]): GameState {
  const s = createDefaultState();
  for (const k of ['attack', 'strength', 'defence']) s.skills[k].lvl = lvl;
  s.skills.hitpoints.lvl = hp; s.maxHp = hp; s.hp = hp;
  s.skills.prayer.lvl = prayer; s.maxPrayerPts = prayer; s.prayerPts = prayer;
  for (const slot of Object.keys(s.equipment)) s.equipment[slot] = null;
  for (const [slot, id] of Object.entries(gear)) { if (!Object.hasOwn(ITEMS, id)) throw new Error(id); s.equipment[slot] = id; }
  s.combatStyle = 'controlled';
  s.activePrayers = new Set(prayers);
  return s;
}
function swing(s: GameState, r: () => number): number {
  // actions.ts 116-121, 179-182, controlled style
  const bon = getEquipmentBonuses(s);
  const maxHit = Math.max(2, Math.floor(1.5 + (s.skills.strength.lvl + 1) * 0.32 + bon.str * 0.22));
  const acc = (s.skills.attack.lvl + 2) * 1.35 + bon.atk + 12;
  const defRoll = MONSTER_TYPES.elvarg_dragon.def * 1.1 + 4;
  const hc = Math.min(0.94, Math.max(0.22, acc / (acc + defRoll * 0.75)));
  return r() < hc ? Math.max(1, Math.floor(r() * (maxHit + 1))) : 0;
}

type F = { make: () => GameState; food: number; heal: number; pots: number; moves: boolean; extraMs: number; ward: boolean; markStep: number; hp: number; capFrac?: number; autoRetaliate?: boolean };
function fight(f: F, seed: number) {
  const r = seeded(seed), s = f.make();
  const HP = f.hp;
  let boss = HP, ph = 0, idx = 0, t = 0, next = 0, shift = 0;
  let eatCd = 0, potCd = 0, atkCd = 0, food = f.food, pots = f.pots, marks = 0, markT = 0;
  let pos: V = { x: MELEE, z: 0 };        // where the hero is (or will be when the current move ends)
  let moveEnd = 0;                          // the hero is still on its old spot until moveEnd
  let prev: V = { ...pos };
  let away = false, backAt = Infinity, waitBasic = false;
  let pending: (Locked & { reactAt: number })[] = [];
  let oneShot = 0, lastHitFrom = 0, heavies = 0, dodged = 0;
  const human = () => (0.04 + 0.12 * r()) + lognormal(r, 0.55, 0.3) + f.extraMs / 1000;
  const here = (): V => (t < moveEnd ? prev : pos);
  const moveTo = (q: V, extra = 0) => { prev = here(); pos = q; moveEnd = t + extra + 0.0625 + Math.hypot(q.x - prev.x, q.z - prev.z) / RUN; };
  const dt = 0.02;
  function hurtHeavy(L: Locked) {
    let d = Math.floor(L.a.power * (0.75 + 0.25 * r()) * (1 + f.markStep * marks));
    marks = Math.min(4, marks + 1); markT = 12;
    if (L.a.style === 'fire') d = (f.ward || s.activePrayers.has('prot_magic')) ? Math.floor(d * 0.25) : resolveDragonfire(d, s).damage;
    else if (L.a.style === 'melee' && s.activePrayers.has('prot_melee')) d = Math.floor(d * 0.2);
    if (f.capFrac) d = Math.min(d, Math.floor(s.maxHp * f.capFrac));
    lastHitFrom = s.hp; s.hp -= d;
  }
  while (t < 900) {
    t += dt; eatCd -= dt; potCd -= dt; atkCd -= dt; markT -= dt; if (markT <= 0) marks = 0;
    if (s.activePrayers.size) { s.prayerPts -= 0.35 * dt; if (s.prayerPts <= 0) s.activePrayers.clear(); }
    if (pots > 0 && potCd <= 0 && s.skills.prayer.lvl >= 25 && s.prayerPts < 6) { pots--; potCd = EAT_CD; s.prayerPts = Math.min(s.maxPrayerPts, s.prayerPts + 18); s.activePrayers.add('prot_magic'); }
    if (shift > 0) { shift -= dt; next = t + 1.0; pending = []; }
    else if (t >= next) {
      const P = PH[ph], id = P.pat[idx++ % P.pat.length];
      if (id === 'basic') {
        lastHitFrom = s.hp; s.hp -= rollMonsterHit('elvarg_dragon', 1, s, r).dmg;
        next = t + CAD * P.mult;
        if (waitBasic && pending.length === 0) { waitBasic = false; backAt = t; } // auto-retaliation re-targets an idle hero
      } else {
        const a = A[id]; heavies++;
        const p = here(), dl = Math.hypot(p.x, p.z) || 1;
        const L: Locked = { a, ox: a.shape.t === 'target' ? p.x : 0, oz: a.shape.t === 'target' ? p.z : 0, dx: p.x / dl, dz: p.z / dl, at: t + a.windup };
        pending.push({ ...L, reactAt: f.moves && r() > 0.05 ? t + human() : Infinity });
        next = t + Math.max(a.slots * CAD * P.mult, a.windup + 0.15);
      }
    }
    for (const L of pending) if (t >= L.reactAt && t < L.at) {
      L.reactAt = Infinity;
      const p = pos; // react from where the hero is heading
      if (inside(L, p)) { const [, q] = escape(L, p); moveTo(q); away = true; backAt = Infinity; waitBasic = false; }
    }
    for (const L of pending) if (t >= L.at) {
      if (inside(L, here())) hurtHeavy(L); else dodged++;
      if (away) {
        if (f.autoRetaliate) waitBasic = true;
        else backAt = Math.max(moveEnd, t + human());
      }
    }
    pending = pending.filter((L) => t < L.at);
    if (away && t >= backAt && pending.length === 0) {
      // walk back to melee reach along the line to the boss
      const p = here(), d = Math.hypot(p.x, p.z);
      if (d > MELEE) moveTo({ x: (p.x * MELEE) / d, z: (p.z * MELEE) / d });
      away = false;
    }
    if (s.hp <= 0) { if (lastHitFrom >= 0.7 * s.maxHp) oneShot++; return { win: false, t, oneShot, heavies, dodged }; }
    const missing = s.maxHp - s.hp;
    if (food > 0 && eatCd <= 0 && (missing >= f.heal || s.hp <= s.maxHp * 0.5)) { food--; eatCd = EAT_CD; atkCd = Math.max(atkCd, 0) + TICK; s.hp = Math.min(s.maxHp, s.hp + f.heal); }
    const p = here();
    const swinging = !away && t >= moveEnd && Math.hypot(p.x, p.z) <= MELEE + 1e-6;
    if (swinging && atkCd <= 0 && shift <= 0) {
      atkCd = TICK;
      const floor = Math.ceil(HP * PH[ph].until);
      boss = Math.max(floor, boss - swing(s, r));
      if (boss <= 0) return { win: true, t, oneShot, heavies, dodged };
      if (boss <= floor && ph < 2) { ph++; idx = 0; shift = 2.0; pending = []; }
    }
  }
  return { win: false, t, oneShot, heavies, dodged };
}

const dragonKit = { weapon: 'dragon_scimitar', body: 'dragon_chain', legs: 'dragon_legs', shield: 'dragon_defender' };
const runeKit = { weapon: 'rune_scimitar', body: 'rune_plate', legs: 'rune_legs', shield: 'rune_shield' };
const mkA = () => profile(70, 70, 45, dragonKit, ['prot_magic']);
const mkF = () => profile(50, 50, 20, runeKit, []);
const base = { food: 20, heal: 24, pots: 4, ward: true, markStep: 0.25, hp: Number(process.env.BOSS_HP || 1200) };
const rows: [string, F][] = [
  ['A prepared, moves', { ...base, make: mkA, moves: true, extraMs: 0 }],
  ['A, auto-retaliation re-engages', { ...base, make: mkA, moves: true, extraMs: 0, autoRetaliate: true }],
  ['B prepared, never moves', { ...base, make: mkA, moves: false, extraMs: 0 }],
  ['C prepared, +300 ms (trackpad)', { ...base, make: mkA, moves: true, extraMs: 300 }],
  ['C2 prepared, +500 ms', { ...base, make: mkA, moves: true, extraMs: 500 }],
  ['D prepared, no food', { ...base, make: mkA, moves: true, extraMs: 0, food: 0 }],
  ['F level 50 rune, moves', { ...base, make: mkF, moves: true, extraMs: 0, food: 10, heal: 16, pots: 0, ward: false }],
  ['G level 50 rune, never moves', { ...base, make: mkF, moves: false, extraMs: 0, food: 10, heal: 16, pots: 0, ward: false }],
  ['A, heavy capped at 45% max HP', { ...base, make: mkA, moves: true, extraMs: 0, capFrac: 0.45 }],
  ['B, heavy capped at 45% max HP', { ...base, make: mkA, moves: false, extraMs: 0, capFrac: 0.45 }],
  ['C, heavy capped at 45% max HP', { ...base, make: mkA, moves: true, extraMs: 300, capFrac: 0.45 }]
];
console.log(`boss HP ${base.hp}; 2000 fights per row; positions, re-engage click and walk back modelled`);
console.log('fighter                             win%   mean s (wins)  deaths by one hit from >=70% HP  heavies dodged');
for (const [name, f] of rows) {
  let w = 0, secs = 0, os = 0, deaths = 0, hv = 0, dg = 0;
  for (let i = 1; i <= 2000; i++) { const o = fight(f, i); if (o.win) { w++; secs += o.t; } else { deaths++; os += o.oneShot; } hv += o.heavies; dg += o.dodged; }
  console.log(`${name.padEnd(34)} ${((w / 20)).toFixed(1).padStart(6)} ${(w ? secs / w : 0).toFixed(0).padStart(10)} ${(deaths ? (os / deaths) * 100 : 0).toFixed(0).padStart(20)}% of deaths ${((dg / Math.max(1, hv)) * 100).toFixed(0).padStart(12)}%`);
}
