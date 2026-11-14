// The positional boss fight (written by the Stage 4 critique as check.ts, 2026-11-14; extended for the owner's
// decisions of the same day). The hero has a position, shapes are tested geometrically at the resolve, the hero
// keeps attacking until it reacts, and after a dodge it clicks the boss again and, if out of reach, walks back.
// Added in the revision: hitpoints regenerate during the fight, ranged and magic heroes (they stand 11 from the
// boss, its own reach, and attack from anywhere within 13.5), the boss as a parameter, damage by source.
import { MONSTER_TYPES } from '../../../../src/data/world';
import { ITEMS } from '../../../../src/data/items';
import { SPELLS } from '../../../../src/data/catalog';
import { playerAttackProfile, playerHitChance, rollMonsterHit } from '../../../../src/state/combat';
import { resolveDragonfire } from '../../../../src/state/adventure';
import { createDefaultState } from '../../../../src/state/gameState';
import type { GameState } from '../../../../src/state/types';
import { BOSS_KEY, BOSS_ROW, type Attack, type BossConfig } from './boss';

// The new boss is not in the game's tables yet: register its row so rollMonsterHit and the swing read it.
(MONSTER_TYPES as Record<string, unknown>)[BOSS_KEY] = BOSS_ROW;

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

export const CAD = 1.65, TICK = 0.6, RUN = 11.5, BODY = 0.3, EAT_CD = 1.8;
export const REGEN_IN_COMBAT = 0.25; // HP per second, today's rate (design 6.6)
const STAND = { melee: 2.9, ranged: 11, magic: 11 }; // the boss (magic, reach 11) closes to 11 of a far hero
const REACH = { melee: 2.9, ranged: 13.5, magic: 13.5 }; // input.ts stop distances

type V = { x: number; z: number };
type Locked = { a: Attack; ox: number; oz: number; dx: number; dz: number; at: number };
function inside(l: Locked, p: V): boolean {
  const s = l.a.shape;
  const rx = p.x - l.ox, rz = p.z - l.oz, d = Math.hypot(rx, rz);
  if (s.type === 'circle') return d <= s.radius;
  if (s.type === 'ring') return d >= s.inner && d <= s.outer;
  if (s.type === 'line') throw new Error('no boss attack is a line');
  if (d > s.length) return false;
  if (d < 1e-9) return true;
  return Math.acos(Math.max(-1, Math.min(1, (rx * l.dx + rz * l.dz) / d))) <= (s.halfAngleDeg * Math.PI) / 180;
}
/** Shortest way out for a point inside: the destination. */
function escape(l: Locked, p: V): V {
  const s = l.a.shape;
  const rx = p.x - l.ox, rz = p.z - l.oz, d = Math.hypot(rx, rz) || 1e-6;
  const ux = rx / d, uz = rz / d;
  if (s.type === 'circle' && s.anchor === 'self') { const k = s.radius - d + BODY; return { x: p.x + ux * k, z: p.z + uz * k }; }
  if (s.type === 'circle') {
    // step sideways around the boss (keeps the distance to it)
    const tx = -p.z, tz = p.x, tl = Math.hypot(tx, tz) || 1;
    return { x: l.ox + (tx / tl) * (s.radius + BODY), z: l.oz + (tz / tl) * (s.radius + BODY) };
  }
  if (s.type === 'ring') {
    const inn = d - s.inner + BODY, out = s.outer - d + BODY;
    if (inn <= out) return { x: p.x - ux * inn, z: p.z - uz * inn };
    return { x: p.x + ux * out, z: p.z + uz * out };
  }
  if (s.type === 'line') throw new Error('no boss attack is a line');
  // cone: sideways to the nearer edge, or out of the far end
  const half = (s.halfAngleDeg * Math.PI) / 180;
  const cos = (rx * l.dx + rz * l.dz) / d, phi = Math.acos(Math.max(-1, Math.min(1, cos)));
  const side = d * Math.sin(half - phi) + BODY, fwd = s.length - d + BODY;
  if (fwd < side) return { x: p.x + ux * fwd, z: p.z + uz * fwd };
  // Straight across the nearer edge: along that edge's outward normal. (The critique's check stepped
  // perpendicular to the axis, which leaves a cone only when it is narrow; at 45 degrees it does not.)
  const sgn = (l.dx * rz - l.dz * rx) >= 0 ? 1 : -1;
  const ang = sgn * (half + Math.PI / 2), nx = l.dx * Math.cos(ang) - l.dz * Math.sin(ang), nz = l.dx * Math.sin(ang) + l.dz * Math.cos(ang);
  return { x: p.x + nx * side, z: p.z + nz * side };
}

export type Style = 'melee' | 'ranged' | 'magic';
export function profile(style: Style, lvl: number, hp: number, prayer: number, gear: Record<string, string>, prayers: string[], spell = 'blood_barrage'): GameState {
  const s = createDefaultState();
  const trained = style === 'melee' ? ['attack', 'strength', 'defence'] : [style, 'defence'];
  for (const k of trained) s.skills[k].lvl = lvl;
  s.skills.hitpoints.lvl = hp; s.maxHp = hp; s.hp = hp;
  s.skills.prayer.lvl = prayer; s.maxPrayerPts = prayer; s.prayerPts = prayer;
  for (const slot of Object.keys(s.equipment)) s.equipment[slot] = null;
  for (const [slot, id] of Object.entries(gear)) { if (!Object.hasOwn(ITEMS, id)) throw new Error(`fight: unknown item ${id}`); s.equipment[slot] = id; }
  s.combatStyle = style === 'melee' ? 'controlled' : style;
  s.activeSpell = spell;
  s.activePrayers = new Set(prayers);
  return s;
}
/** One attack of the hero, through Stage 3's own functions (playerAttackProfile, playerHitChance; R0 replaced the
 *  hand transcription of actions.ts). The damage roll and the Blood Barrage heal are actions.ts's. [damage, heal]. */
function swing(s: GameState, typeKey: string, r: () => number): [number, number] {
  const { maxHit, accuracy } = playerAttackProfile(s);
  const healRatio = s.combatStyle === 'magic' ? ((SPELLS.find((x: { id: string }) => x.id === s.activeSpell) as { healRatio?: number }).healRatio || 0) : 0;
  const hc = playerHitChance(accuracy, MONSTER_TYPES[typeKey].def);
  const dmg = r() < hc ? Math.max(1, Math.floor(r() * (maxHit + 1))) : 0;
  return [dmg, dmg > 0 && healRatio ? Math.max(1, Math.floor(dmg * healRatio)) : 0];
}

export type Fighter = {
  style: Style; make: () => GameState; food: number; heal: number; pots: number; moves: boolean; extraMs: number;
  ward: boolean; capFrac?: number; autoRetaliate?: boolean; regen?: number; eatCd?: number;
};
export type Outcome = { win: boolean; t: number; oneShot: number; heavies: number; dodged: number; by: Record<string, number> };

export function fight(f: Fighter, boss: BossConfig, seed: number): Outcome {
  const r = seeded(seed), s = f.make();
  const HP = boss.hp, PH = boss.phases, A = boss.attacks;
  const stand = STAND[f.style], reach = REACH[f.style];
  const regen = f.regen ?? REGEN_IN_COMBAT, eatEvery = f.eatCd ?? EAT_CD;
  let bossHp = HP, ph = 0, idx = 0, t = 0, next = 0, shift = 0;
  let eatCd = 0, potCd = 0, atkCd = 0, food = f.food, pots = f.pots, marks = 0, markT = 0;
  let pos: V = { x: stand, z: 0 };        // where the hero is (or will be when the current move ends)
  let moveEnd = 0;                          // the hero is still on its old spot until moveEnd
  let prev: V = { ...pos };
  let away = false, backAt = Infinity, waitBasic = false;
  let pending: (Locked & { reactAt: number })[] = [];
  let oneShot = 0, lastHitFrom = 0, heavies = 0, dodged = 0;
  const by: Record<string, number> = { basic: 0 };
  const human = () => (0.04 + 0.12 * r()) + lognormal(r, 0.55, 0.3) + f.extraMs / 1000;
  const here = (): V => (t < moveEnd ? prev : pos);
  const moveTo = (q: V) => { prev = here(); pos = q; moveEnd = t + 0.0625 + Math.hypot(q.x - prev.x, q.z - prev.z) / RUN; };
  const dt = 0.02;
  const out = (win: boolean): Outcome => ({ win, t, oneShot, heavies, dodged, by });
  function hurtHeavy(L: Locked) {
    let d = Math.floor(L.a.power! * (0.75 + 0.25 * r()) * (1 + boss.markStep * marks));
    marks = Math.min(4, marks + 1); markT = 12;
    if (L.a.style === 'fire') d = (f.ward || s.activePrayers.has('prot_magic')) ? Math.floor(d * 0.25) : resolveDragonfire(d, s).damage;
    else if (L.a.style === 'melee' && s.activePrayers.has('prot_melee')) d = Math.floor(d * 0.2);
    if (f.capFrac) d = Math.min(d, Math.floor(s.maxHp * f.capFrac));
    lastHitFrom = s.hp; s.hp -= d; by[L.a.id] = (by[L.a.id] || 0) + d;
  }
  while (t < 900) {
    t += dt; eatCd -= dt; potCd -= dt; atkCd -= dt; markT -= dt; if (markT <= 0) marks = 0;
    if (s.hp > 0 && s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + regen * dt); // the whole fight is "in combat"
    if (s.activePrayers.size) { s.prayerPts -= 0.35 * dt; if (s.prayerPts <= 0) s.activePrayers.clear(); }
    if (pots > 0 && potCd <= 0 && s.skills.prayer.lvl >= 25 && s.prayerPts < 6) { pots--; potCd = EAT_CD; s.prayerPts = Math.min(s.maxPrayerPts, s.prayerPts + 18); s.activePrayers.add('prot_magic'); }
    if (shift > 0) { shift -= dt; next = t + 1.0; pending = []; }
    else if (t >= next) {
      const P = PH[ph], id = P.pattern[idx++ % P.pattern.length];
      if (id === 'basic') {
        const d = rollMonsterHit(boss.typeKey, 1, s, r).dmg;
        lastHitFrom = s.hp; s.hp -= d; by.basic += d;
        next = t + CAD * P.cadenceMult;
        if (waitBasic && pending.length === 0) { waitBasic = false; backAt = t; } // auto-retaliation re-targets an idle hero
      } else {
        const a = A[id]; heavies++;
        const p = here(), dl = Math.hypot(p.x, p.z) || 1;
        const atTarget = a.shape.type === 'circle' && a.shape.anchor === 'target';
        const L: Locked = { a, ox: atTarget ? p.x : 0, oz: atTarget ? p.z : 0, dx: p.x / dl, dz: p.z / dl, at: t + a.windupMs / 1000 };
        pending.push({ ...L, reactAt: f.moves && r() > 0.05 ? t + human() : Infinity });
        next = t + Math.max(a.slots * CAD * P.cadenceMult, a.windupMs / 1000 + 0.15);
      }
    }
    for (const L of pending) if (t >= L.reactAt && t < L.at) {
      L.reactAt = Infinity;
      const p = pos; // react from where the hero is heading
      if (inside(L, p)) { moveTo(escape(L, p)); away = true; backAt = Infinity; waitBasic = false; }
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
      // the click on the boss: walk back along the line to it only if it is out of reach
      const p = here(), d = Math.hypot(p.x, p.z);
      if (d > reach) moveTo({ x: (p.x * reach) / d, z: (p.z * reach) / d });
      away = false;
    }
    if (s.hp <= 0) { if (lastHitFrom >= 0.7 * s.maxHp) oneShot++; return out(false); }
    const missing = s.maxHp - s.hp;
    if (food > 0 && eatCd <= 0 && (missing >= f.heal || s.hp <= s.maxHp * 0.5)) { food--; eatCd = eatEvery; atkCd = Math.max(atkCd, 0) + TICK; s.hp = Math.min(s.maxHp, s.hp + f.heal); }
    const p = here();
    const swinging = !away && t >= moveEnd && Math.hypot(p.x, p.z) <= reach + 1e-6;
    if (swinging && atkCd <= 0 && shift <= 0) {
      atkCd = TICK;
      const floor = Math.ceil(HP * PH[ph].untilHpFrac);
      const [dmg, healed] = swing(s, boss.typeKey, r);
      if (healed) s.hp = Math.min(s.maxHp, s.hp + healed);
      bossHp = Math.max(floor, bossHp - dmg);
      if (bossHp <= 0) return out(true);
      if (bossHp <= floor && ph < PH.length - 1) { ph++; idx = 0; shift = 2.0; pending = []; }
    }
  }
  return out(false);
}

// ---------------------------------------------------------------- the fighters (fixed: tuning never touches them)
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
export const FIGHTERS: Record<string, Fighter> = {
  A: { ...prepared, style: 'melee', make: mkA },
  Aauto: { ...prepared, style: 'melee', make: mkA, autoRetaliate: true },
  B: { ...prepared, style: 'melee', make: mkA, moves: false },
  C: { ...prepared, style: 'melee', make: mkA, extraMs: 300 },
  C2: { ...prepared, style: 'melee', make: mkA, extraMs: 500 },
  D: { ...prepared, style: 'melee', make: mkA, food: 0 },
  E: { ...prepared, style: 'melee', make: () => profile('melee', 60, 60, 43, dragonKit, ['prot_magic']), food: 16, pots: 3 },
  F: { ...unprepared, style: 'melee', make: mkF },
  G: { ...unprepared, style: 'melee', make: mkF, moves: false },
  R: { ...prepared, style: 'ranged', make: mkR },     // the ward here is the quest's (no ranged ward shield below level 75)
  Rslow: { ...prepared, style: 'ranged', make: mkR, extraMs: 300 },
  Rstill: { ...prepared, style: 'ranged', make: mkR, moves: false },
  M: { ...prepared, style: 'magic', make: mkM },
  Mslow: { ...prepared, style: 'magic', make: mkM, extraMs: 300 },
  Mstill: { ...prepared, style: 'magic', make: mkM, moves: false },
  FR: { ...unprepared, style: 'ranged', make: mkR50 },
  FM: { ...unprepared, style: 'magic', make: mkM50 }
};
export const LABELS: Record<string, string> = {
  A: 'A melee, prepared, moves', Aauto: 'A, auto-retaliation re-engages', B: 'B melee, prepared, never moves',
  C: 'C melee, prepared, +300 ms (trackpad)', C2: 'C2 melee, prepared, +500 ms', D: 'D melee, prepared, no food',
  E: 'E melee, level 60, dragon kit', F: 'F melee, level 50 rune, unprepared', G: 'G melee, level 50, never moves',
  R: 'R ranged, prepared, moves', Rslow: 'R ranged, +300 ms', Rstill: 'R ranged, never moves',
  M: 'M magic, prepared, moves', Mslow: 'M magic, +300 ms', Mstill: 'M magic, never moves',
  FR: 'FR ranged, level 50, unprepared', FM: 'FM magic, level 50, unprepared'
};

export function table(boss: BossConfig, keys: string[], over: Partial<Fighter> = {}, n = 2000): string[] {
  const lines = ['fighter                                 win%  mean s (wins)  one-hit deaths from >=70% HP  heavies dodged  damage taken per fight, by source'];
  for (const k of keys) {
    const f = { ...FIGHTERS[k], ...over };
    let w = 0, secs = 0, os = 0, deaths = 0, hv = 0, dg = 0; const by: Record<string, number> = {};
    for (let i = 1; i <= n; i++) {
      const o = fight(f, boss, i);
      if (o.win) { w++; secs += o.t; } else { deaths++; os += o.oneShot; }
      hv += o.heavies; dg += o.dodged;
      for (const [id, d] of Object.entries(o.by)) by[id] = (by[id] || 0) + d;
    }
    const src = Object.entries(by).map(([id, d]) => `${id} ${(d / n).toFixed(0)}`).join(', ');
    lines.push(`${LABELS[k].padEnd(38)} ${((w / n) * 100).toFixed(1).padStart(5)} ${(w ? secs / w : 0).toFixed(0).padStart(10)} ${(deaths ? (os / deaths) * 100 : 0).toFixed(0).padStart(20)}% ${((dg / Math.max(1, hv)) * 100).toFixed(0).padStart(18)}%   ${src}`);
  }
  return lines;
}
