// Income arithmetic of plan Z3 (design 7.6; `model.ts` section 8 of the content model), written once so that the dungeon
// test (Z3) and the cave test (C1) read the same two functions. Pure arithmetic over the live tables: no clock, no random
// source. A "model fighter" has every fighting skill at `level`, the best ordinary melee kit that level can wear, and no
// rests. Every figure is a rate in GP per second, and a test asserts only ratios of two of them, never a time (rule 0.3.11).
import { BOSSES } from '../../src/data/attacks';
import { ITEMS, unitSellPrice } from '../../src/data/items';
import { MONSTER_TYPES } from '../../src/data/world';
import { CAMPS } from '../../src/data/worldMap';
import { getEquipmentBonuses } from '../../src/state/combat';
import { createDefaultState } from '../../src/state/gameState';
import { DEAD_SECS, DYING_SECS } from '../../src/state/monsterAi';

/** Stage 3's seconds from one kill to the next monster of a camp (design 4.2). */
export const STEP_SECS = 1.5;
/** Seconds of the model's walking, as the design's 11.5 units a second. */
export const WALK_SPEED = 11.5;
/** Seconds from a death to the monster's return on open ground: dying plus dead (8.35). */
export const RESPAWN_WAIT = DYING_SECS + DEAD_SECS;
/** Seconds of one swing. */
const SWING = 0.6;

type Item = { id: string; type: string; slot?: string; style?: string; tier?: string; atk?: number; str?: number; def?: number; rng?: number; mag?: number; req?: Record<string, number> };
type Drop = { id?: string; chance: number; gp?: [number, number]; qty?: number };
type Mon = { level: number; hp: number; def: number; drops: Drop[] };

const BONES = ['bones', 'big_bones', 'dragon_bones'];
const SPECIAL_TIERS = ['raids', 'botw', 'barrows', 'bandos', 'gilded'];
const SPECIAL_IDS = ['abyssal_whip', 'toxic_blowpipe', 'trident_seas', 'granite_body', 'granite_legs'];
const mon = (type: string): Mon => {
  const m = (MONSTER_TYPES as unknown as Record<string, Mon>)[type];
  if (!m) throw new Error(`income: unknown monster type "${type}"`);
  return m;
};

/** The sale value of `qty` of an item; an unknown id throws, so a table cannot pay in something that does not exist. */
export function saleValue(id: string, qty = 1): number {
  const item = (ITEMS as unknown as Record<string, Item>)[id];
  if (!item) throw new Error(`income: unknown item "${id}"`);
  return unitSellPrice(item as never) * qty;
}

/** Coins and goods of one kill: the mean coin drop plus every non-bone item drop at its chance and sale value. */
export function killPay(type: string): number {
  let pay = 0;
  for (const d of mon(type).drops) {
    if (d.gp) pay += (d.chance * (d.gp[0] + d.gp[1])) / 2;
    else if (d.id && !BONES.includes(d.id)) pay += d.chance * (d.qty ?? 1) * saleValue(d.id);
  }
  return pay;
}

/** Seconds the model fighter takes to kill one monster: its hitpoints over the fighter's damage per swing. */
export function killSecs(type: string, level: number): number {
  const m = mon(type);
  const state = createDefaultState();
  for (const k of Object.keys(state.equipment)) state.equipment[k] = null;
  for (const k of Object.keys(state.skills)) if (k !== 'hitpoints' && k !== 'prayer') state.skills[k].lvl = level;
  const items = Object.values(ITEMS as unknown as Record<string, Item>);
  const wearable = (i: Item) => Object.values(i.req ?? {}).every((v) => v <= level);
  const ordinary = (i: Item) => !SPECIAL_TIERS.includes(String(i.tier)) && !SPECIAL_IDS.includes(i.id);
  const best = (slot: string, key: (i: Item) => number) =>
    items
      .filter((i) => i.type === 'equip' && i.slot === slot && wearable(i) && ordinary(i) && (slot === 'weapon' ? i.style === 'melee' : !i.rng && !i.mag))
      .sort((a, b) => key(b) - key(a))[0];
  const weapon = best('weapon', (i) => (i.atk ?? 0) + (i.str ?? 0));
  const body = best('body', (i) => i.def ?? 0);
  const legs = best('legs', (i) => i.def ?? 0);
  if (weapon) state.equipment.weapon = weapon.id;
  if (body) state.equipment.body = body.id;
  if (legs) state.equipment.legs = legs.id;
  const bon = getEquipmentBonuses(state);
  const maxHit = Math.max(2, Math.floor(1.5 + (level + 1) * 0.32 + bon.str * 0.22));
  const acc = (level + 2) * 1.35 + bon.atk + 12;
  const hit = Math.min(0.94, Math.max(0.22, acc / (acc + (m.def * 1.1 + 4) * 0.75)));
  const perSwing = (hit * (1 + (maxHit * (maxHit + 1)) / 2)) / (maxHit + 1);
  return (m.hp / perSwing) * SWING;
}

/**
 * GP a second of a camp of `types` killed in turn: its coins and goods over the longer of the summed kill times plus
 * 1.5 s each, and the camp's respawn wait plus the slowest kill.
 */
export function campRate(types: string[], level: number): number {
  const kills = types.map((t) => killSecs(t, level));
  const pay = types.reduce((s, t) => s + killPay(t), 0);
  const cycle = Math.max(kills.reduce((s, k) => s + k + STEP_SECS, 0), RESPAWN_WAIT + Math.max(...kills));
  return pay / cycle;
}

/**
 * The best open ground for the model fighter: over every non-boss monster type of `CAMPS` up to ten levels above the
 * fighter's skills, the pay a second of the largest group of that type in one camp.
 */
export function openGroundBest(level: number): { type: string; rate: number } {
  const group: Record<string, number> = {};
  for (const c of CAMPS) for (const m of c.members) group[m.type] = Math.max(group[m.type] ?? 0, c.members.filter((x) => x.type === m.type).length);
  let best = { type: '', rate: 0 };
  for (const [type, n] of Object.entries(group)) {
    if (mon(type).level > level + 10 || (BOSSES as Record<string, unknown>)[type]) continue;
    const rate = campRate(Array<string>(n).fill(type), level);
    if (rate > best.rate) best = { type, rate };
  }
  if (!best.type) throw new Error(`income: no open ground for a fighter at ${level}`);
  return best;
}
