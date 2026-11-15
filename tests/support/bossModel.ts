// The positional boss fight of design 6.4, ported from docs/superpowers/research/combat-model/fight.ts (plan B3).
// It reads the shipped tables (MONSTER_TYPES, ATTACKS, BOSSES) and calls the game's own rules: rollMonsterHit and
// rollMonsterAttack for the boss, addMark / tickMarks for the marks, inShape for every shape, regenRate for the
// hero's regeneration, and Stage 3's playerAttackProfile / playerHitChance for the hero's swing. What stays the
// model's own: positions, the hero's reaction time and the way out of a shape, eating and the prayer drain.
import { ATTACKS, BOSSES, BOSS_FIRST_ENTRY_SECS, CADENCE_SECS, type AttackDef } from '../../src/data/attacks';
import { SPELLS } from '../../src/data/catalog';
import { ITEMS } from '../../src/data/items';
import { MONSTER_TYPES } from '../../src/data/world';
import { TICK_SEC } from '../../src/engine/context';
import { addMark, playerAttackProfile, playerHitChance, rollMonsterAttack, rollMonsterHit, tickMarks, type Marks } from '../../src/state/combat';
import { createDefaultState } from '../../src/state/gameState';
import { FOOD_CD_SECS, regenRate } from '../../src/state/sustain';
import { inShape } from '../../src/state/telegraph';
import type { GameState } from '../../src/state/types';

export const BOSS_KEY = 'ashmantle';

export function seeded(seed: number): () => number {
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

const RUN = 11.5;
const BODY = 0.3;
const STAND = { melee: 2.9, ranged: 11, magic: 11 }; // the boss (magic, reach 11) closes to 11 of a far hero
const REACH = { melee: 2.9, ranged: 13.5, magic: 13.5 }; // input.ts stop distances

type V = { x: number; z: number };
type Locked = { a: AttackDef; ox: number; oz: number; dx: number; dz: number; at: number };
const inside = (l: Locked, p: V) => inShape(l.a.shape, l.ox, l.oz, l.dx, l.dz, p.x, p.z);

/** Shortest way out for a point inside: the destination (fight.ts, unchanged). */
function escape(l: Locked, p: V): V {
  const s = l.a.shape;
  const rx = p.x - l.ox, rz = p.z - l.oz, d = Math.hypot(rx, rz) || 1e-6;
  const ux = rx / d, uz = rz / d;
  if (s.type === 'circle' && s.anchor === 'self') { const k = s.radius - d + BODY; return { x: p.x + ux * k, z: p.z + uz * k }; }
  if (s.type === 'circle') {
    const tx = -p.z, tz = p.x, tl = Math.hypot(tx, tz) || 1;
    return { x: l.ox + (tx / tl) * (s.radius + BODY), z: l.oz + (tz / tl) * (s.radius + BODY) };
  }
  if (s.type === 'ring') {
    const inn = d - s.inner + BODY, out = s.outer - d + BODY;
    if (inn <= out) return { x: p.x - ux * inn, z: p.z - uz * inn };
    return { x: p.x + ux * out, z: p.z + uz * out };
  }
  if (s.type === 'line') throw new Error('bossModel: no boss attack is a line');
  const half = (s.halfAngleDeg * Math.PI) / 180;
  const cos = (rx * l.dx + rz * l.dz) / d, phi = Math.acos(Math.max(-1, Math.min(1, cos)));
  const side = d * Math.sin(half - phi) + BODY, fwd = s.length - d + BODY;
  if (fwd < side) return { x: p.x + ux * fwd, z: p.z + uz * fwd };
  const sgn = (l.dx * rz - l.dz * rx) >= 0 ? 1 : -1;
  const ang = sgn * (half + Math.PI / 2), nx = l.dx * Math.cos(ang) - l.dz * Math.sin(ang), nz = l.dx * Math.sin(ang) + l.dz * Math.cos(ang);
  return { x: p.x + nx * side, z: p.z + nz * side };
}

export type Style = 'melee' | 'ranged' | 'magic';
function profile(style: Style, lvl: number, hp: number, prayer: number, gear: Record<string, string>, prayers: string[], spell = 'blood_barrage'): GameState {
  const s = createDefaultState();
  const trained = style === 'melee' ? ['attack', 'strength', 'defence'] : [style, 'defence'];
  for (const k of trained) s.skills[k].lvl = lvl;
  s.skills.hitpoints.lvl = hp; s.maxHp = hp; s.hp = hp;
  s.skills.prayer.lvl = prayer; s.maxPrayerPts = prayer; s.prayerPts = prayer;
  for (const slot of Object.keys(s.equipment)) s.equipment[slot] = null;
  for (const [slot, id] of Object.entries(gear)) { if (!Object.hasOwn(ITEMS, id)) throw new Error(`bossModel: unknown item ${id}`); s.equipment[slot] = id; }
  s.combatStyle = style === 'melee' ? 'controlled' : style;
  s.activeSpell = spell;
  s.activePrayers = new Set(prayers);
  return s;
}
/** One attack of the hero through Stage 3's functions; the damage roll and the spell's heal are actions.ts's. */
function swing(s: GameState, r: () => number): [number, number] {
  const { maxHit, accuracy } = playerAttackProfile(s);
  const healRatio = s.combatStyle === 'magic' ? ((SPELLS.find((x: { id: string }) => x.id === s.activeSpell) as { healRatio?: number }).healRatio || 0) : 0;
  const hc = playerHitChance(accuracy, MONSTER_TYPES[BOSS_KEY].def);
  const dmg = r() < hc ? Math.max(1, Math.floor(r() * (maxHit + 1))) : 0;
  return [dmg, dmg > 0 && healRatio ? Math.max(1, Math.floor(dmg * healRatio)) : 0];
}

export type Fighter = {
  style: Style; make: () => GameState; food: number; heal: number; pots: number; moves: boolean; extraMs: number;
  /** The quest's ward (state.quests.dragonfireWard); a warding shield works through the shield slot. */
  ward: boolean;
};
export type Outcome = { win: boolean; t: number; heavies: number; dodged: number };

export function fight(f: Fighter, seed: number): Outcome {
  const boss = BOSSES[BOSS_KEY];
  const r = seeded(seed), s = f.make();
  s.quests.dragonfireWard = f.ward;
  const HP = MONSTER_TYPES[BOSS_KEY].hp, PH = boss.phases;
  const stand = STAND[f.style], reach = REACH[f.style];
  const regen = regenRate(0); // the whole fight is "in combat"
  let bossHp = HP, ph = 0, idx = 0, t = 0, next = 0;
  let shift = boss.openingShiftMs / 1000; // the opening roar (approval note): untouchable, no attack
  let eatCd = 0, potCd = 0, atkCd = 0, food = f.food, pots = f.pots;
  const marks: Marks = { count: 0, left: 0 };
  let pos: V = { x: stand, z: 0 };
  let moveEnd = 0;
  let prev: V = { ...pos };
  let away = false, backAt = Infinity;
  let pending: (Locked & { reactAt: number })[] = [];
  let heavies = 0, dodged = 0;
  const human = () => (0.04 + 0.12 * r()) + lognormal(r, 0.55, 0.3) + f.extraMs / 1000;
  const here = (): V => (t < moveEnd ? prev : pos);
  const moveTo = (q: V) => { prev = here(); pos = q; moveEnd = t + 0.0625 + Math.hypot(q.x - prev.x, q.z - prev.z) / RUN; };
  const dt = 0.02;
  const out = (win: boolean): Outcome => ({ win, t, heavies, dodged });
  while (t < 900) {
    t += dt; eatCd -= dt; potCd -= dt; atkCd -= dt;
    tickMarks(marks, dt);
    if (s.hp > 0 && s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + regen * dt);
    if (s.activePrayers.size) { s.prayerPts -= 0.35 * dt; if (s.prayerPts <= 0) s.activePrayers.clear(); }
    if (pots > 0 && potCd <= 0 && s.skills.prayer.lvl >= 25 && s.prayerPts < 6) { pots--; potCd = FOOD_CD_SECS; s.prayerPts = Math.min(s.maxPrayerPts, s.prayerPts + 18); s.activePrayers.add('prot_magic'); }
    if (shift > 0) { shift -= dt; next = t + BOSS_FIRST_ENTRY_SECS; pending = []; }
    else if (t >= next) {
      const P = PH[ph], id = P.pattern[idx++ % P.pattern.length];
      if (id === 'basic') {
        s.hp -= rollMonsterHit(BOSS_KEY, 1, s, r).dmg;
        next = t + CADENCE_SECS * P.cadenceMult;
      } else {
        const a = ATTACKS[id]; heavies++;
        const p = here(), dl = Math.hypot(p.x, p.z) || 1;
        const atTarget = a.shape.type === 'circle' && a.shape.anchor === 'target';
        const L: Locked = { a, ox: atTarget ? p.x : 0, oz: atTarget ? p.z : 0, dx: p.x / dl, dz: p.z / dl, at: t + a.windupMs / 1000 };
        pending.push({ ...L, reactAt: f.moves && r() > 0.05 ? t + human() : Infinity });
        next = t + Math.max(a.slots * CADENCE_SECS * P.cadenceMult, a.windupMs / 1000 + 0.15);
      }
    }
    for (const L of pending) if (t >= L.reactAt && t < L.at) {
      L.reactAt = Infinity;
      if (inside(L, pos)) { moveTo(escape(L, pos)); away = true; backAt = Infinity; }
    }
    for (const L of pending) if (t >= L.at) {
      if (inside(L, here())) {
        s.hp -= rollMonsterAttack(BOSS_KEY, L.a, s, marks, r).dmg;
        addMark(marks, boss);
      } else dodged++;
      if (away) backAt = Math.max(moveEnd, t + human());
    }
    pending = pending.filter((L) => t < L.at);
    if (away && t >= backAt && pending.length === 0) {
      const p = here(), d = Math.hypot(p.x, p.z);
      if (d > reach) moveTo({ x: (p.x * reach) / d, z: (p.z * reach) / d });
      away = false;
    }
    if (s.hp <= 0) return out(false);
    const missing = s.maxHp - s.hp;
    if (food > 0 && eatCd <= 0 && (missing >= f.heal || s.hp <= s.maxHp * 0.5)) { food--; eatCd = FOOD_CD_SECS; atkCd = Math.max(atkCd, 0) + TICK_SEC; s.hp = Math.min(s.maxHp, s.hp + f.heal); }
    const p = here();
    const swinging = !away && t >= moveEnd && Math.hypot(p.x, p.z) <= reach + 1e-6;
    if (swinging && atkCd <= 0 && shift <= 0) {
      atkCd = TICK_SEC;
      const floor = Math.round(HP * PH[ph].untilHpFrac); // crossPhase's threshold
      const [dmg, healed] = swing(s, r);
      if (healed) s.hp = Math.min(s.maxHp, s.hp + healed);
      bossHp = Math.max(floor, bossHp - dmg);
      if (bossHp <= 0) return out(true);
      if (bossHp <= floor && ph < PH.length - 1) { ph++; idx = 0; shift = PH[ph].shiftMs / 1000; pending = []; }
    }
  }
  return out(false);
}

// ---------------------------------------------------------------- the fighters of design 6.4 (fixed: tuning never touches them)
const dragonKit = { weapon: 'dragon_scimitar', body: 'dragon_chain', legs: 'dragon_legs', shield: 'dragon_defender' };
const runeKit = { weapon: 'rune_scimitar', body: 'rune_plate', legs: 'rune_legs', shield: 'rune_shield' };
const rangedKit = { weapon: 'armadyl_crossbow', body: 'red_dhide_body', legs: 'red_dhide_chaps', shield: 'rune_shield' };
const rangedKit50 = { weapon: 'rune_crossbow', body: 'green_dhide_body', legs: 'green_dhide_chaps', shield: 'rune_shield' };
const magicKit = { weapon: 'ancient_staff', body: 'bloodbark_top', legs: 'bloodbark_bottom', shield: 'tome_of_fire' };
const magicKit50 = { weapon: 'ancient_staff', body: 'mystic_top', legs: 'mystic_bottom' };
const prepared = { food: 20, heal: 24, pots: 4, ward: true, moves: true, extraMs: 0 };
const unprepared = { food: 10, heal: 16, pots: 0, ward: false, moves: true, extraMs: 0 };
const mkA = () => profile('melee', 70, 70, 45, dragonKit, ['prot_magic']);
const mkF = () => profile('melee', 50, 50, 20, runeKit, []);
const mkR = () => profile('ranged', 70, 70, 45, rangedKit, ['prot_magic']);
const mkM = () => profile('magic', 70, 70, 45, magicKit, ['prot_magic']);
const mkR50 = () => profile('ranged', 50, 50, 20, rangedKit50, []);
const mkM50 = () => profile('magic', 50, 50, 20, magicKit50, []);
export const FIGHTERS: Record<string, Fighter & { label: string }> = {
  A: { ...prepared, style: 'melee', make: mkA, label: 'A melee, prepared, moves' },
  B: { ...prepared, style: 'melee', make: mkA, moves: false, label: 'B melee, prepared, never moves' },
  C: { ...prepared, style: 'melee', make: mkA, extraMs: 300, label: 'C melee, prepared, +300 ms' },
  F: { ...unprepared, style: 'melee', make: mkF, label: 'F melee, level 50 rune, unprepared' },
  G: { ...unprepared, style: 'melee', make: mkF, moves: false, label: 'G melee, level 50, never moves' },
  R: { ...prepared, style: 'ranged', make: mkR, label: 'R ranged, prepared, moves' },
  Rstill: { ...prepared, style: 'ranged', make: mkR, moves: false, label: 'R ranged, never moves' },
  M: { ...prepared, style: 'magic', make: mkM, label: 'M magic, prepared, moves' },
  Mstill: { ...prepared, style: 'magic', make: mkM, moves: false, label: 'M magic, never moves' },
  FR: { ...unprepared, style: 'ranged', make: mkR50, label: 'FR ranged, level 50, unprepared' },
  FM: { ...unprepared, style: 'magic', make: mkM50, label: 'FM magic, level 50, unprepared' }
};

/** Win share, mean length of the wins and share of heavies dodged over seeds 1..n. */
export function runRow(key: string, n: number): { win: number; meanWinSecs: number; dodged: number } {
  const f = FIGHTERS[key];
  let w = 0, secs = 0, hv = 0, dg = 0;
  for (let i = 1; i <= n; i++) {
    const o = fight(f, i);
    if (o.win) { w++; secs += o.t; }
    hv += o.heavies; dg += o.dodged;
  }
  return { win: w / n, meanWinSecs: w ? secs / w : 0, dodged: dg / Math.max(1, hv) };
}
