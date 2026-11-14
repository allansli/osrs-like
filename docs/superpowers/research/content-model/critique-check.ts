// Independent re-check written by the Stage 6 critique (2026-11-14). It reuses content.ts and the game's tables but
// none of model.ts's arithmetic for income, so it can disagree with it. Run: bash critique-check.sh (writes
// critique-results.txt). Deterministic: no clock, no random source.
import { ITEMS, unitSellPrice } from '../../../../src/data/items';
import { MONSTER_TYPES } from '../../../../src/data/world';
import { CAMPS } from '../../../../src/data/worldMap';
import { SPELLS } from '../../../../src/data/magic';
import { getEquipmentBonuses } from '../../../../src/state/combat';
import { createDefaultState } from '../../../../src/state/gameState';
import * as C from './content';

const out: string[] = [];
const p = (s = '') => out.push(s);
type AnyItem = { id?: string; name: string; type: string; price: number; [k: string]: unknown };
const items: Record<string, AnyItem> = { ...(ITEMS as Record<string, AnyItem>) };
for (const [id, it] of Object.entries(C.NEW_ITEMS)) items[id] = it;
const sell = (id: string) => unitSellPrice(items[id] as never);
type Drop = { id?: string; chance: number; gp?: [number, number]; qty?: number };
type M = { name: string; level: number; hp: number; def: number; drops: Drop[] };
const mons: Record<string, M> = {};
for (const [k, m] of Object.entries(MONSTER_TYPES as unknown as Record<string, M>)) {
  // Stage 3: equipment drops x0.05 (dragon 0.05 flat) -- same overlay as model.ts
  mons[k] = { ...m, drops: m.drops.map((d) => (d.id && items[d.id]?.type === 'equip' ? { ...d, chance: k === 'elvarg_dragon' ? C.S3.DRAGON_GEAR_DROP : d.chance * C.S3.GEAR_DROP_MULT } : d)) };
}
for (const [k, m] of Object.entries(C.S4_MONSTERS)) mons[k] = m as unknown as M;
for (const [k, m] of Object.entries(C.NEW_MONSTERS)) mons[k] = m as unknown as M;
for (const [k, add] of Object.entries(C.ADDED_DROPS)) mons[k] = { ...mons[k], drops: [...mons[k].drops, ...add] };
const coin = (m: M) => m.drops.filter((d) => d.gp).reduce((s, d) => s + d.chance * (d.gp![0] + d.gp![1]) / 2, 0);
const goods = (m: M, withBones: boolean) => m.drops.filter((d) => d.id && (withBones || items[d.id].type !== 'bones')).reduce((s, d) => s + d.chance * (d.qty || 1) * sell(d.id!), 0);

// The hero's melee damage per 0.6 s: the same formula as performPlayerAttack (actions.ts), best ordinary kit by level.
function meleeAvg(lvl: number, def: number) {
  const s = createDefaultState();
  for (const k of Object.keys(s.equipment)) s.equipment[k] = null;
  const ok = (i: AnyItem) => Object.values((i.req as Record<string, number>) || {}).every((v) => v <= lvl) && !['raids', 'botw', 'barrows', 'bandos', 'gilded'].includes(String(i.tier)) && !['abyssal_whip', 'granite_body', 'granite_legs'].includes(String(i.id));
  for (const slot of ['weapon', 'body', 'legs']) {
    const pool = Object.values(items).filter((i) => i.type === 'equip' && i.slot === slot && ok(i) && (slot === 'weapon' ? i.style === 'melee' : !i.rng && !i.mag));
    pool.sort((a, b) => slot === 'weapon' ? (((b.atk as number) || 0) + ((b.str as number) || 0)) - (((a.atk as number) || 0) + ((a.str as number) || 0)) : ((b.def as number) || 0) - ((a.def as number) || 0));
    if (pool[0]) s.equipment[slot] = String(pool[0].id);
  }
  const bon = getEquipmentBonuses(s);
  const maxHit = Math.max(2, Math.floor(1.5 + (lvl + 1) * 0.32 + bon.str * 0.22)), acc = (lvl + 2) * 1.35 + bon.atk + 12;
  const hc = Math.min(0.94, Math.max(0.22, acc / (acc + (def * 1.1 + 4) * 0.75)));
  return hc * (1 + (maxHit * (maxHit + 1)) / 2) / (maxHit + 1);
}

// ---- A. open ground, every overworld type including the new camps, by hero level
p('=== A. Open ground per second (melee, no rests), coins only and coins + goods at sale value (bones excluded)');
const size: Record<string, number> = {};
for (const c of CAMPS) for (const m of c.members) size[m.type] = (size[m.type] || 0) + 1;
Object.assign(size, { saltback_stalker: 3, thornwatch_marksman: 2 });
for (const c of C.NEW_CAMPS) for (const m of c.members) size[m.type] = (size[m.type] || 0) + 1;
const bosses = new Set([...Object.keys(C.BOSSES), 'elvarg_dragon']);
function rate(k: string, lvl: number) {
  const m = mons[k]; const kt = (m.hp / meleeAvg(lvl, m.def)) * 0.6;
  const respawn = k === 'marrowjaw' ? 180 : 8.35;
  const cyc = Math.max(kt + 1.5, (respawn + kt) / size[k]);
  return { c: coin(m) / cyc, g: (coin(m) + goods(m, false)) / cyc, hpps: m.hp / cyc };
}
for (const lvl of [45, 50, 55, 60, 65, 70]) {
  const rows = Object.keys(size).filter((k) => mons[k] && mons[k].level <= lvl + 10 && !bosses.has(k)).map((k) => ({ k, ...rate(k, lvl) })).sort((a, b) => b.c - a.c).slice(0, 4);
  p(`  hero ${lvl}: ` + rows.map((r) => `${r.k} ${r.c.toFixed(1)} (${r.g.toFixed(1)} with goods, ${r.hpps.toFixed(1)} hp/s)`).join(' | '));
}
p('  coins per hitpoint (what the pacing model\'s fighter is paid per unit of the hp/s it maximises):');
p('   ' + ['goblin', 'hill_giant', 'saltback_stalker', 'thornwatch_marksman', 'moss_guardian', 'cinder_adept', 'slag_brute', 'lesser_demon', 'marrowjaw'].map((k) => `${k} ${(coin(mons[k]) / mons[k].hp).toFixed(2)}`).join(', '));

// ---- B. dungeon run, all goods on both sides
p('');
p('=== B. Dungeon run against the best open ground at the same level, goods counted on BOTH sides (bones excluded)');
for (const d of C.DUNGEONS) {
  const lvl = d.id === 'underkiln' ? 70 : 45;
  let secs = 0, coins = 0, gd = 0;
  for (const c of d.camps) for (const m of c.members) { const mon = mons[m.type]; secs += (mon.hp / meleeAvg(lvl, mon.def)) * 0.6; coins += coin(mon); gd += goods(mon, false); }
  const rooms = Object.entries(d.rooms).filter(([id]) => !/^c\d$/.test(id)).map(([, r]) => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]);
  let walk = 0; for (let i = 1; i < rooms.length; i++) walk += Math.hypot(rooms[i][0] - rooms[i - 1][0], rooms[i][1] - rooms[i - 1][1]);
  const total = secs + walk * 1.5 / 11.5;
  const ch = C.CHESTS[d.id];
  const chest = (ch.runGp[0] + ch.runGp[1]) / 2 + ch.run.reduce((s, r) => s + sell(r.id) * (r.qty[0] + r.qty[1]) / 2, 0);
  const ore = d.nodes.reduce((s, n) => s + sell(n.type === 'runite_rock' ? 'runite_ore' : 'adamantite_ore'), 0);
  const cand = Object.keys(size).filter((k) => mons[k] && mons[k].level <= lvl + 10 && !bosses.has(k)).map((k) => ({ k, ...rate(k, lvl) }));
  const bestC = cand.sort((a, b) => b.c - a.c)[0], bestG = [...cand].sort((a, b) => b.g - a.g)[0];
  const asModel = (coins + chest) / total, all = (coins + gd + chest) / total, allOre = (coins + gd + chest + ore) / (total + 3 * d.nodes.length);
  p(`  ${d.name} (hero ${lvl}): ${total.toFixed(0)} s; as the model counts it (monster coins + chest) ${asModel.toFixed(1)} GP/s = ${(asModel / bestC.c).toFixed(2)} of ${bestC.k} ${bestC.c.toFixed(1)}`);
  p(`     + every monster's and the boss's goods: ${all.toFixed(1)} GP/s = ${(all / bestG.g).toFixed(2)} of ${bestG.k} with goods ${bestG.g.toFixed(1)}; + one ore from each node (3 s each): ${allOre.toFixed(1)} = ${(allOre / bestG.g).toFixed(2)}`);
  p(`     goods left out by model.ts: ${gd.toFixed(0)} GP a run, of which the boss ${goods(mons[d.camps.find((c) => c.arenaRadius)!.members[0].type], false).toFixed(0)}`);
}

// ---- C. drops at their best processed value (craft or bind), against coins
p('');
p('=== C. Material drops at the sale value of what they make (best recipe), against the 25% bound measured raw');
const recipes = C.NEW_RECIPES;
const best = (id: string) => { let v = sell(id); for (const r of recipes) if (r.input[id] && Object.keys(r.input).length === 1) v = Math.max(v, sell(r.output) * (r.outputQty || 1) / r.input[id]); return v; };
for (const [k, add] of Object.entries(C.ADDED_DROPS)) {
  const m = mons[k], raw = add.reduce((s, d) => s + d.chance * (d.qty || 1) * sell(d.id!), 0), made = add.reduce((s, d) => s + d.chance * (d.qty || 1) * best(d.id!), 0);
  p(`  ${k.padEnd(18)} coins ${coin(m).toFixed(0).padStart(4)}: raw +${(100 * raw / coin(m)).toFixed(0)}%, worked +${(100 * made / coin(m)).toFixed(0)}%`);
}
for (const k of ['cinder_adept', 'slag_brute']) {
  const m = mons[k], mats = m.drops.filter((d) => d.id && ['cinder_silk', 'slag_hide'].includes(d.id));
  p(`  ${k.padEnd(18)} coins ${coin(m).toFixed(0).padStart(4)}: raw +${(100 * mats.reduce((s, d) => s + d.chance * sell(d.id!), 0) / coin(m)).toFixed(0)}%, worked +${(100 * mats.reduce((s, d) => s + d.chance * best(d.id!), 0) / coin(m)).toFixed(0)}%`);
}
// bones bound instead of buried
const bindValue = (bone: string) => { const r = recipes.filter((x) => x.input[bone]).map((x) => sell(x.output) * (x.outputQty || 1) - sell('runestone')).sort((a, b) => b - a)[0]; return r; };
p(`  a bone bound and sold instead of sold: big bones ${sell('big_bones')} -> ${bindValue('big_bones')}, dragon bones ${sell('dragon_bones')} -> ${bindValue('dragon_bones')} (lesser demon coins ${coin(mons.lesser_demon).toFixed(0)}: +${(100 * (bindValue('dragon_bones') - sell('dragon_bones')) / coin(mons.lesser_demon)).toFixed(0)}%)`);

// ---- D. Kilnglass for a dragon kit
p('');
const ch = C.CHESTS.underkiln, perRun = (ch.run[0].qty[0] + ch.run[0].qty[1]) / 2 + 2;
p(`=== D. Kilnglass: first clear ${ch.first[0].qty} + chest ${(ch.run[0].qty[0] + ch.run[0].qty[1]) / 2} (mean) + boss 2 = ${ch.first[0].qty + perRun}; the kit needs 13 ingots = 13 shards; ml_kiln takes 1 and pays 2 ingots`);

// ---- E. one hand-check per boss: mean time to cut the boss's hitpoints with the fighter's own kit, no dodging, plus the phase shifts
p('');
p('=== E. Boss kill time, by hand: hp / (damage per swing) x 0.6 s + 2 s per phase change (no dodging, no walking)');
function avgWith(kit: Record<string, string>, lvl: number, def: number) {
  const s = createDefaultState(); for (const k of Object.keys(s.equipment)) s.equipment[k] = null; Object.assign(s.equipment, kit);
  const bon = getEquipmentBonuses(s);
  const maxHit = Math.max(2, Math.floor(1.5 + (lvl + 1) * 0.32 + bon.str * 0.22)), acc = (lvl + 2) * 1.35 + bon.atk + 12;
  const hc = Math.min(0.94, Math.max(0.22, acc / (acc + (def * 1.1 + 4) * 0.75)));
  return hc * (1 + (maxHit * (maxHit + 1)) / 2) / (maxHit + 1);
}
for (const [k, kit, lvl, model] of [
  ['marrowjaw', { weapon: 'addy_scimitar', body: 'addy_plate', legs: 'addy_legs' }, 35, 61],
  ['saltfang', { weapon: 'rune_scimitar', body: 'rune_plate', legs: 'rune_legs', shield: 'rune_shield' }, 50, 89],
  ['kiln_warden', { weapon: 'dragon_scimitar', body: 'dragon_chain', legs: 'dragon_legs', shield: 'dragon_defender' }, 70, 99]
] as [string, Record<string, string>, number, number][]) {
  const m = C.NEW_MONSTERS[k], a = avgWith(kit, lvl, m.def), t = (m.hp / a) * 0.6 + 2 * (C.BOSSES[k].phases.length - 1);
  p(`  ${m.name}: ${a.toFixed(2)} a swing, ${t.toFixed(0)} s with no time lost; the fight model's mean ${model} s, so dodging and walking cost ${(100 * (model - t) / model).toFixed(0)}% of the fight`);
}
// runes per kill at 70, bound
const bb = SPELLS.find((s: { id: string }) => s.id === 'blood_barrage') as { runes: Record<string, number> };
p(`  blood barrage runes: ${JSON.stringify(bb.runes)}`);
console.log(out.join('\n'));
