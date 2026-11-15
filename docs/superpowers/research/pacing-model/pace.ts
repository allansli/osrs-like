// Independent second-pass model of design 4.2, reading the real tables and functions of src/ at a8cad85.
// Counts kills to each level gate and each kit. Times only steer target choice.
import { MONSTER_TYPES } from '/home/rdrosa/gitprojects/allan/osrs-like-wp/S3/src/data/world';
import { ITEMS } from '/home/rdrosa/gitprojects/allan/osrs-like-wp/S3/src/data/items';
import { getLevelForXp } from '/home/rdrosa/gitprojects/allan/osrs-like-wp/S3/src/data/skills';
import { getEquipmentBonuses } from '/home/rdrosa/gitprojects/allan/osrs-like-wp/S3/src/state/combat';
import { SLAYER_BANDS, combatLevel, pickSlayerBand } from '/home/rdrosa/gitprojects/allan/osrs-like-wp/S3/src/state/adventure';
import { createDefaultState } from '/home/rdrosa/gitprojects/allan/osrs-like-wp/S3/src/state/gameState';

// Stage 2 camps on feat/world-place b6f38da: total count and largest aggressive camp per type.
const COUNT: Record<string, number> = { chicken: 4, goblin: 5, goblin_archer: 2, dark_wizard: 3, dark_ranger: 2, hill_giant: 4, scorpion: 5, moss_guardian: 4, lesser_demon: 6, elvarg_dragon: 1 };
const ATTACKERS: Record<string, number> = { dark_wizard: 3, dark_ranger: 2, hill_giant: 4, scorpion: 3, moss_guardian: 2, lesser_demon: 4, elvarg_dragon: 1 };
const TIERS = [1, 5, 10, 15, 20, 30, 40, 60];
const WEAP: Record<number, string> = { 1: 'bronze_scimitar', 5: 'iron_scimitar', 10: 'steel_longsword', 15: 'black_scimitar', 20: 'mith_scimitar', 30: 'addy_scimitar', 40: 'rune_scimitar', 60: 'dragon_scimitar' };
const BODY: Record<number, string> = { 1: 'bronze_plate', 5: 'iron_plate', 10: 'steel_plate', 15: 'black_plate', 20: 'mith_plate', 30: 'addy_plate', 40: 'rune_plate', 60: 'dragon_chain' };
const LEGS: Record<number, string> = { 1: 'bronze_legs', 5: 'iron_legs', 10: 'steel_legs', 15: 'black_legs', 20: 'mith_legs', 30: 'addy_legs', 40: 'rune_legs', 60: 'dragon_legs' };
const TIER_OF: Record<string, number> = {};
for (const t of TIERS) { TIER_OF[WEAP[t]] = t; TIER_OF[BODY[t]] = t; TIER_OF[LEGS[t]] = t; }
const KIT = new Set(Object.keys(TIER_OF));
const BOUNTY_AFTER: Record<string, number> = { goblin: 400, scorpion: 300, dark_wizard: 400, hill_giant: 600, moss_guardian: 1100, lesser_demon: 1800 };

const avg = (m: number) => (1 + (m * (m + 1)) / 2) / (m + 1);
const sell = (id: string) => Math.floor((ITEMS[id].price || 0) * 0.65);

export interface Opts { mult: number; markup: number; dropScale: number | null; slayer: boolean; afterBounties: boolean; extras: boolean }

export function simulate(o: Opts) {
  const s = createDefaultState();
  s.gp = 0; s.xpMultiplier = o.mult; s.inventory = [];
  for (const k of Object.keys(s.equipment)) s.equipment[k] = null;
  s.combatStyle = 'controlled';
  s.equipment.weapon = 'bronze_scimitar';
  const owned = new Set<string>(['bronze_scimitar']);
  const exp: Record<string, number> = {};
  let nk = 0, t = 0, gp = 0, last = '';
  let task: { m: string; left: number; bounty: number; kx: number; bx: number } | null = { m: 'goblin', left: 6, bounty: 400, kx: 12, bx: 80 };
  let chainDone = false, questsDone = false;
  const gate: Record<number, number> = {}, kit: Record<number, number> = {};
  const lvl = (k: string) => s.skills[k].lvl;
  const addXp = (k: string, x: number) => { s.skills[k].xp += x; s.skills[k].lvl = getLevelForXp(s.skills[k].xp); if (k === 'hitpoints') s.maxHp = s.skills[k].lvl; };
  const record = () => {
    const tw = Math.min(...['weapon', 'body', 'legs'].map((sl) => (s.equipment[sl] ? TIER_OF[s.equipment[sl]!] ?? 0 : 0)));
    for (const T of TIERS) {
      if (T <= tw && kit[T] === undefined) kit[T] = nk;
      if (gate[T] === undefined && lvl('attack') >= T && lvl('defence') >= T) gate[T] = nk;
    }
  };
  const upgrade = () => {
    for (const [slot, table, sk] of [['weapon', WEAP, 'attack'], ['body', BODY, 'defence'], ['legs', LEGS, 'defence']] as const) {
      const cur = s.equipment[slot] ? TIER_OF[s.equipment[slot]!] ?? 0 : 0;
      const ok = TIERS.filter((T) => T > cur && T <= lvl(sk) && (owned.has(table[T]) || gp >= ITEMS[table[T]].price! * o.markup));
      if (!ok.length) continue;
      const want = table[Math.max(...ok)];
      if (!owned.has(want)) { gp -= ITEMS[want].price! * o.markup; t += 40; owned.add(want); }
      s.equipment[slot] = want;
    }
  };
  const fight = (mk: string) => {
    const m = MONSTER_TYPES[mk];
    const b = getEquipmentBonuses(s);
    const maxHit = Math.max(2, Math.floor(1.5 + (lvl('strength') + 1) * 0.32 + b.str * 0.22));
    const acc = (lvl('attack') + 2) * 1.35 + b.atk + 12;
    const hc = Math.min(0.94, Math.max(0.22, acc / (acc + (m.def * 1.1 + 4) * 0.75)));
    const kill = (m.hp / (hc * avg(maxHit))) * 0.6;
    const pdef = lvl('defence') * 1.2 + b.def + 10;
    const ma = m.atk * 1.25 + 8;
    const mhc = Math.min(0.82, Math.max(0.12, ma / (ma + pdef)));
    const att = ATTACKERS[mk] && m.level >= combatLevel(s) ? ATTACKERS[mk] : 1;
    const dmg = att * (kill / 1.65) * mhc * avg(m.maxHit);
    const win = dmg <= 0.6 * lvl('hitpoints') && att * m.maxHit < lvl('hitpoints');
    const cycle = Math.max(kill + 1.5, (8.35 + kill) / COUNT[mk]);
    let food = 0;
    for (const d of m.drops) if (d.id && ITEMS[d.id]?.type === 'food') food += d.chance * (ITEMS[d.id].heal || 0);
    const rest = Math.max(0, dmg - 0.25 * cycle - food) / 0.25;
    return { win, tpk: cycle + rest };
  };
  record();
  while (kit[60] === undefined && nk < 20000) {
    let best: [number, string, number] | null = null;
    for (const mk of Object.keys(COUNT)) {
      const f = fight(mk);
      if (!f.win) continue;
      const rate = MONSTER_TYPES[mk].hp / f.tpk;
      if (!best || rate > best[0]) best = [rate, mk, f.tpk];
    }
    let [, mk, tpk] = best!;
    if (!chainDone) { mk = 'goblin'; tpk = fight('goblin').tpk; }
    if (mk !== last) { if (last) t += 30; last = mk; }
    if (o.slayer && !task) {
      const band = pickSlayerBand(combatLevel(s));
      if (band) task = { m: band.monster, left: band.count, bounty: o.afterBounties ? BOUNTY_AFTER[band.monster] : band.bountyGp, kx: band.killXp, bx: band.bountyXp };
      t += 10;
    }
    t += tpk; nk++;
    const m = MONSTER_TYPES[mk];
    const hp = m.hp * o.mult;
    addXp('attack', 1.4 * hp); addXp('strength', 1.3 * hp); addXp('defence', 1.3 * hp); addXp('hitpoints', 1.5 * hp);
    for (const d of m.drops) {
      if (d.gp) { gp += d.chance * (d.gp[0] + d.gp[1]) / 2; continue; }
      if (!d.id || o.dropScale === null) continue;
      const it = ITEMS[d.id];
      if (it?.type !== 'equip') continue;
      const c = mk === 'elvarg_dragon' ? (o.dropScale === 1 ? d.chance : 0.05) : d.chance * o.dropScale;
      if (KIT.has(d.id) && !owned.has(d.id)) { exp[d.id] = (exp[d.id] || 0) + c; if (exp[d.id] >= 1) owned.add(d.id); }
      else gp += c * sell(d.id);
    }
    if (task && task.m === mk) {
      addXp('attack', task.kx); task.left--;
      if (task.left <= 0) { gp += task.bounty; addXp('attack', task.bx); task = null; }
    }
    if (!chainDone) {
      chainDone = true; gp += 25; t += 6 * 90;
      for (const id of ['bronze_plate', 'bronze_legs']) owned.add(id);
      s.equipment.body = 'bronze_plate'; s.equipment.legs = 'bronze_legs';
      if (o.extras) { s.equipment.head = 'bronze_helm'; s.equipment.shield = 'wooden_shield'; s.equipment.feet = 'leather_boots'; }
    } else if (!questsDone && mk === 'goblin') {
      questsDone = true; gp += 1300; t += 180; addXp('attack', 250); addXp('hitpoints', 250);
    }
    record(); upgrade(); record();
  }
  return { gate, kit, t };
}

const names = ['bronze', 'iron', 'steel', 'black', 'mithril', 'adamant', 'rune', 'dragon'];
function show(label: string, o: Opts) {
  const r = simulate(o);
  const fk = TIERS.slice(1, 6).map((T) => r.kit[T] - r.gate[T]);
  const behind = TIERS.slice(1, 7).map((T, i) => TIERS.slice(i + 2).filter((U) => r.gate[U] !== undefined && r.gate[U] < r.kit[T]).length);
  console.log(`${label.padEnd(36)} gate ${TIERS.slice(1).map((T) => r.gate[T]).join('/')}  kit ${TIERS.slice(1).map((T) => r.kit[T]).join('/')}  further(i..a) ${fk.join('/')}  behind(i..r) ${behind.join('/')}`);
}
const base: Opts = { mult: 1, markup: 10, dropScale: null, slayer: false, afterBounties: true, extras: false };
show('A1 1x m10', base);
show('A1 1x m10, helm/shield/boots worn', { ...base, extras: true });
for (const mk of [8, 9, 11, 12]) show(`A1 1x m${mk}`, { ...base, markup: mk });
show('A3 1x m10', { ...base, dropScale: 0.05, slayer: true });
show('A3 1x m10 extras', { ...base, dropScale: 0.05, slayer: true, extras: true });
for (const ds of [0.025, 0.1]) show(`A3 1x m10 ds${ds}`, { ...base, dropScale: ds, slayer: true });
show('CTRL no slayer', { ...base, markup: 1, dropScale: 1 });
show('CTRL slayer', { ...base, markup: 1, dropScale: 1, slayer: true, afterBounties: false });
show('CTRL no drops, markup 1 (start+1x only)', { ...base, markup: 1 });
show('A1 10x m10', { ...base, mult: 10 });
show('A1 10x m8', { ...base, mult: 10, markup: 8 });
