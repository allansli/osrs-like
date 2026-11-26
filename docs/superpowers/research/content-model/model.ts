// Stage 6 content model. Reads the game's real tables and pure rules (Stages 1 to 5 and the models pass merged; R0 deleted
// the S3 and S4_MONSTERS overlays), adds the Stage 6 proposal and prints every number the design quotes.
// Deterministic: no clock, no random source. Run with run.sh; the output is committed as results.txt.
import { GEAR_MARKUP, ITEMS, unitSellPrice } from '../../../../src/data/items';
import { BOSS_ARENA_MARGIN, BOSSES } from '../../../../src/data/attacks';
import { FORGE_RECIPES } from '../../../../src/data/recipes';
import { MONSTER_TYPES, RESOURCE_NODES_DEF, WORLD_REGIONS } from '../../../../src/data/world';
import { SPELLS } from '../../../../src/data/magic';
import { CAMPS, PATHS, SAFE_ZONES } from '../../../../src/data/worldMap';
import { NODE_PLACEMENTS } from '../../../../src/data/placements';
import { WOODS_TREES } from '../../../../src/data/woodsTrees';
import { CAMERA_FAR, HORIZON_APRON } from '../../../../src/data/look';
import { OSRS_XP_TABLE } from '../../../../src/data/skills';
import { isWalkable, nearestOnPolyline } from '../../../../src/state/collision';
import { getTerrainHeight } from '../../../../src/state/terrain';
import { getEquipmentBonuses } from '../../../../src/state/combat';
import { createDefaultState } from '../../../../src/state/gameState';
import { serializeState } from '../../../../src/state/save';
import * as C from './content';

const out: string[] = [];
const p = (s = '') => out.push(s);
const h = (s: string) => { p(); p('=== ' + s); };
let failures = 0;
const check = (ok: boolean, what: string) => { if (!ok) { failures++; p('  FAIL ' + what); } return ok; };

// ---------------------------------------------------------------- tables after Stages 3, 4 and 6
type AnyItem = { name: string; type: string; price: number; [k: string]: unknown };
const items: Record<string, AnyItem> = { ...(ITEMS as Record<string, AnyItem>) };
for (const [id, it] of Object.entries(C.NEW_ITEMS)) items[id] = it;
const sell = (id: string) => { if (!items[id]) throw new Error('unknown item ' + id); return unitSellPrice(items[id] as never); };

type R = { id: string; name: string; skill: string; req: number; xp: number; input: Record<string, number>; output?: string; outputQty?: number; kind?: string };
const recipesToday: R[] = FORGE_RECIPES as R[];
const recipesS6: R[] = [...recipesToday, ...C.NEW_RECIPES];

type M = { name: string; level: number; hp: number; maxHit: number; atk: number; def: number; style: string; drops: { id?: string; chance: number; gp?: [number, number]; qty?: number }[] };
const monstersToday = MONSTER_TYPES as unknown as Record<string, M>;
const monsters: Record<string, M> = {};
for (const [k, m] of Object.entries(monstersToday)) monsters[k] = { ...m, drops: [...m.drops] };
for (const [k, m] of Object.entries(C.NEW_MONSTERS)) monsters[k] = m as unknown as M;
for (const [k, add] of Object.entries(C.ADDED_DROPS)) monsters[k] = { ...monsters[k], drops: [...monsters[k].drops, ...add] };
const meanCoin = (m: M) => m.drops.filter((d) => d.gp).reduce((s, d) => s + d.chance * (d.gp![0] + d.gp![1]) / 2, 0);

// ---------------------------------------------------------------- 1. loops
h('1. Loops: where each non-equipment item comes from and where it goes');
function loops(recipes: R[], mons: Record<string, M>, nodes: Record<string, { item: string }>, label: string) {
  const src: Record<string, Set<string>> = {}, snk: Record<string, Set<string>> = {};
  const add = (m: Record<string, Set<string>>, id: string, w: string) => { (m[id] ||= new Set()).add(w); };
  for (const n of Object.values(nodes)) add(src, n.item, 'gather');
  for (const r of recipes) { if (r.output) add(src, r.output, 'craft'); for (const i of Object.keys(r.input)) add(snk, i, 'craft'); }
  for (const m of Object.values(mons)) for (const d of m.drops) if (d.id) add(src, d.id, 'drop');
  for (const sp of SPELLS) for (const r of Object.keys(sp.runes)) add(snk, r, 'cast');
  const rows: string[] = [];
  for (const [id, it] of Object.entries(items)) {
    if (it.type === 'equip') continue;
    if (label === 'today' && C.NEW_ITEMS[id]) continue;
    if (id.startsWith('ember_')) continue; // used from the backpack for experience
    if (it.type === 'food' || it.type === 'potion') add(snk, id, 'consume');
    if (it.type === 'bones') add(snk, id, 'bury');
    if (it.type === 'ammo' && /(_arrow|_bolts)$/.test(id)) add(snk, id, 'shoot');
    const s = [...(src[id] || [])], k = [...(snk[id] || [])];
    if (!s.length || !k.length) rows.push(`  ${id.padEnd(16)} source: ${(s.join(',') || 'SHOP ONLY').padEnd(14)} use: ${k.join(',') || 'NONE (sell only)'}`);
  }
  p(`${label}: ${rows.length} open`); rows.forEach((r) => p(r));
}
loops(recipesToday, monstersToday, RESOURCE_NODES_DEF as never, 'today');
loops(recipesS6, monsters, { ...(RESOURCE_NODES_DEF as never as Record<string, { item: string }>), ...C.NEW_NODES }, 'after Stage 6');
const craftedGear = (rs: R[]) => new Set(rs.filter((r) => r.output && items[r.output]?.type === 'equip').map((r) => r.output!));
p(`equipment with a recipe: today ${craftedGear(recipesToday).size}, after Stage 6 ${craftedGear(recipesS6).size} (of ${Object.values(items).filter((i) => i.type === 'equip').length})`);

// ---------------------------------------------------------------- 2. the 2.5 rule on every new recipe
h('2. Stage 3 rule G3.3 on the new recipes: output sells for at most 2.5 times what the inputs sell for');
const ratio = (r: R) => (sell(r.output!) * (r.outputQty || 1)) / Object.entries(r.input).reduce((s, [id, q]) => s + sell(id) * q, 0);
let worst = 0;
for (const r of C.NEW_RECIPES) {
  const x = ratio(r); worst = Math.max(worst, x);
  p(`  ${r.id.padEnd(22)} ${r.skill.padEnd(11)} req ${String(r.req).padStart(2)} xp ${String(r.xp).padStart(4)}  in ${Object.entries(r.input).map(([i, q]) => q + ' ' + i).join(' + ').padEnd(30)} out ${(r.outputQty || 1)} ${r.output!.padEnd(18)} ratio ${x.toFixed(2)}`);
  check(x <= 2.5 + 1e-9, `${r.id} ratio ${x.toFixed(2)} > 2.5`);
  check(!!items[r.output!], `${r.id} output exists`);
}
p(`worst ratio ${worst.toFixed(2)}; smithing recipes below 1.00 (a loss): ${C.NEW_RECIPES.filter((r) => r.kind === 'smith' && ratio(r) < 1).map((r) => r.id).join(', ') || 'none'}`);
for (const r of C.NEW_RECIPES.filter((x) => (x.kind === 'smith' || x.kind === 'craft') && items[x.output!].type === 'equip')) {
  const wear = Math.max(...Object.values((items[r.output!].req as Record<string, number>) || { x: 1 }));
  check(r.req <= Math.max(wear + 5, 10), `${r.id}: recipe level ${r.req} far above wear level ${wear}`);
}

// ---------------------------------------------------------------- 3. what the new drops add to a kill
h('3. Income per kill: mean coins (unchanged) and what the new material drops add at sale value');
for (const [k, add] of Object.entries(C.ADDED_DROPS)) {
  const m = monsters[k], coin = meanCoin(m), extra = add.reduce((s, d) => s + d.chance * (d.qty || 1) * sell(d.id!), 0);
  p(`  ${k.padEnd(20)} coins ${coin.toFixed(0).padStart(5)}  materials +${extra.toFixed(1).padStart(6)}  (${((extra / Math.max(1, coin)) * 100).toFixed(0)}% of coins)`);
  if (k !== 'chicken') check(extra <= 0.25 * coin, `${k}: materials add more than 25% of coins`);
}
for (const [k, m] of Object.entries(C.NEW_MONSTERS)) {
  for (const d of m.drops) if (d.id && items[d.id]?.type === 'equip') check(false, `${k} drops equipment ${d.id}`);
  const mats = m.drops.filter((d) => d.id && !['bones', 'big_bones', 'dragon_bones'].includes(d.id)).reduce((s, d) => s + d.chance * (d.qty || 1) * sell(d.id!), 0);
  p(`  ${k.padEnd(20)} level ${m.level} hp ${m.hp} coins ${meanCoin(m as never).toFixed(0)} other drops ${mats.toFixed(0)}`);
}

// ---------------------------------------------------------------- 4. new skills on the current curve
h('4. New skills on the current XP curve: actions from one unlock to the next (1x, no lamps)');
function ladder(skill: string, pick: (lvl: number) => R) {
  const reqs = [...new Set(C.NEW_RECIPES.filter((r) => r.skill === skill).map((r) => r.req))].sort((a, b) => a - b);
  let xp = 0, lvl = 1, total = 0;
  for (const target of [...reqs.slice(1), 70, 99]) {
    let n = 0;
    while (lvl < target) { const r = pick(lvl); xp += r.xp; n++; while (lvl < 99 && xp >= OSRS_XP_TABLE[lvl + 1]) lvl++; }
    total += n;
    p(`  ${skill} to ${String(target).padStart(2)}: ${String(n).padStart(6)} actions (running total ${total}), XP ${OSRS_XP_TABLE[target]}`);
  }
}
const best = (skill: string, kinds: string[]) => (lvl: number) => C.NEW_RECIPES.filter((r) => r.skill === skill && kinds.includes(r.kind) && r.req <= lvl).sort((a, b) => b.xp - a.xp)[0];
ladder('crafting', best('crafting', ['craft']));
ladder('runebinding', best('runebinding', ['bind']));
p('  unlock tables:');
for (const s of ['crafting', 'runebinding']) p(`    ${s}: ` + C.NEW_RECIPES.filter((r) => r.skill === s).map((r) => `${r.req} ${items[r.output!].name}`).join('; '));
p('  materials for one full set, by the recipes above:');
for (const [a, b] of [['craft_green_chaps', 'craft_green_body'], ['craft_blue_chaps', 'craft_blue_body'], ['craft_red_chaps', 'craft_red_body'], ['craft_black_chaps', 'craft_black_body'], ['craft_mystic_bottom', 'craft_mystic_top'], ['craft_infinity_bottom', 'craft_infinity_top']]) {
  const ra = C.NEW_RECIPES.find((r) => r.id === a)!, rb = C.NEW_RECIPES.find((r) => r.id === b)!;
  const mat = Object.keys(ra.input)[0], need = ra.input[mat] + rb.input[mat];
  const srcs = Object.entries(monsters).flatMap(([k, m]) => m.drops.filter((d) => d.id === mat && d.chance < 1).map((d) => `${k} ${Math.round(need / (d.chance * (d.qty || 1)))} kills`));
  p(`    ${items[rb.output!].name} + ${items[ra.output!].name}: ${need} ${mat}  <- ${srcs.join(' or ')}; shop price of the pair ${(items[ra.output!].price + items[rb.output!].price) * GEAR_MARKUP} GP`);
}
p(`  embers: all fifteen diary tiers pay ${C.DIARY_REGIONS.length * C.DIARY_TIERS.reduce((t, d) => t + d.xp, 0)} XP in all; put into one skill from level 1 that is level ${(() => { let l = 1; const x = C.DIARY_REGIONS.length * C.DIARY_TIERS.reduce((t, d) => t + d.xp, 0); while (l < 99 && OSRS_XP_TABLE[l + 1] <= x) l++; return l; })()}; one hard-tier ember is ${(40000 / 72000 * 60).toFixed(0)} minutes of a level-67 fighter's experience in one melee skill (section 11)`);
p('  melee kits by the forge (bars for sword + legs + body):');
for (const [tier, ids] of Object.entries({ steel: ['smith_steel_sword', 'smith_steel_legs', 'smith_steel_plate'], black: ['smith_black_scim', 'smith_black_legs', 'smith_black_plate'], adamant: ['smith_addy_scim', 'smith_addy_legs', 'smith_addy_plate'], dragon: ['smith_wyrm_scim', 'smith_wyrm_legs', 'smith_wyrm_chain'] })) {
  const rs = ids.map((i) => C.NEW_RECIPES.find((r) => r.id === i)!);
  const bar = Object.keys(rs[0].input)[0], n = rs.reduce((s, r) => s + r.input[bar], 0);
  p(`    ${tier}: ${n} ${bar}, Smithing ${rs[0].req} to ${rs[2].req}; shop price of the kit ${rs.reduce((s, r) => s + items[r.output!].price, 0) * GEAR_MARKUP} GP`);
}

// ---------------------------------------------------------------- 5. the three styles: today, and after the rebalance (design 7.12)
h('5. The three styles, level band by level band: today and after the rebalance (design 7.12)');
// The kit of a band: the best ORDINARY weapon, body and legs the level can wear (special tiers and uniques left out; 5c shows them).
// The attack arithmetic is Stage 3's playerAttackProfile, transcribed, with the three style numbers of content.ts as parameters:
//   ranged  max hit = max(2, floor(rangedBase + 0.35 x Ranged + rangedGear x ranged bonus + arrow power))
//   magic   max hit = max(3, floor((spell + 0.22 x Magic + 0.18 x magic bonus) x magicScale))
//   melee   max hit = max(2, floor(1.5 + 0.32 x (Strength + style) + 0.22 x strength bonus))            (not touched)
// Accuracy, the hit chance, the 0.6 s swing and every monster number are not touched either.
type StyleCfg = typeof C.STYLE_TODAY;
type Opt = { cfg?: StyleCfg; ammo?: number; spell?: string; special?: boolean; runes?: Record<string, Record<string, number>> };
const combatSpells = () => [...SPELLS].filter((x) => x.type === 'combat').sort((a, b) => (a.maxHit || 0) - (b.maxHit || 0));
const tierSpell = (lvl: number) => combatSpells().filter((x) => x.req <= lvl).pop()!;
function kitOf(style: 'melee' | 'ranged' | 'magic', lvl: number, special = false) {
  const s = createDefaultState();
  for (const k of Object.keys(s.equipment)) s.equipment[k] = null;
  for (const k of Object.keys(s.skills)) if (k !== 'hitpoints' && k !== 'prayer') s.skills[k].lvl = lvl;
  const wearable = (it: AnyItem) => Object.entries((it.req as Record<string, number>) || {}).every(([, v]) => v <= lvl);
  const key = style === 'melee' ? (i: AnyItem) => ((i.atk as number) || 0) + ((i.str as number) || 0) : style === 'ranged' ? (i: AnyItem) => (i.rng as number) || 0 : (i: AnyItem) => (i.mag as number) || 0;
  const tierOk = (i: AnyItem) => special || (!['raids', 'botw', 'barrows', 'bandos', 'gilded'].includes(String(i.tier)) && !['abyssal_whip', 'toxic_blowpipe', 'trident_seas', 'granite_body', 'granite_legs'].includes(String(i.id)));
  const ids: string[] = [];
  for (const slot of ['weapon', 'body', 'legs']) {
    const pool = Object.values(ITEMS as Record<string, AnyItem>).filter((i) => i.type === 'equip' && i.slot === slot && wearable(i) && tierOk(i))
      .filter((i) => slot !== 'weapon' ? (style === 'melee' ? !i.rng && !i.mag : key(i) > 0) : i.style === style);
    const pick = pool.sort((a, b) => (slot === 'weapon' ? key(b) - key(a) : (style === 'melee' ? ((b.def as number) - (a.def as number)) : key(b) - key(a))))[0];
    if (pick) { s.equipment[slot] = String(pick.id); ids.push(String(pick.id)); }
  }
  return { s, ids };
}
function profileOf(style: 'melee' | 'ranged' | 'magic', lvl: number, bon: { atk: number; str: number; rng: number; mag: number }, o: Opt = {}) {
  const cfg = o.cfg || C.STYLE_TODAY;
  if (style === 'ranged') return { maxHit: Math.max(2, Math.floor(cfg.rangedBase + lvl * 0.35 + bon.rng * cfg.rangedGear + (o.ammo || 0))), acc: lvl * 1.4 + bon.rng + 12 };
  if (style === 'magic') { const sp = o.spell ? SPELLS.find((x) => x.id === o.spell)! : tierSpell(lvl); return { maxHit: Math.max(3, Math.floor(((sp.maxHit || 0) + lvl * 0.22 + bon.mag * 0.18) * cfg.magicScale)), acc: lvl * 1.5 + bon.mag + 16 }; }
  return { maxHit: Math.max(2, Math.floor(1.5 + (lvl + 1) * 0.32 + bon.str * 0.22)), acc: (lvl + 2) * 1.35 + bon.atk + 12 };
}
function dps(style: 'melee' | 'ranged' | 'magic', lvl: number, target: M, o: Opt = {}) {
  const { s, ids } = kitOf(style, lvl, o.special);
  const bon = getEquipmentBonuses(s);
  const { maxHit, acc } = profileOf(style, lvl, bon, o);
  const sp = style === 'magic' ? (o.spell ? SPELLS.find((x) => x.id === o.spell)! : tierSpell(lvl)) : null;
  const runes = sp ? ((o.runes && o.runes[sp.id]) || sp.runes) : {};
  const cost = style === 'ranged' ? items.bronze_arrow.price : Object.entries(runes).reduce((t, [r, q]) => t + items[r].price * q, 0);
  const hc = Math.min(0.94, Math.max(0.22, acc / (acc + (target.def * 1.1 + 4) * 0.75)));
  const avg = hc * (1 + (maxHit * (maxHit + 1)) / 2) / (maxHit + 1);
  const price = ids.reduce((t, i) => t + (ITEMS as Record<string, AnyItem>)[i].price, 0) * GEAR_MARKUP;
  return { avg, maxHit, cost, def: bon.def, ids, price, spell: sp?.id || '', runes };
}
const AFTER = C.STYLE_AFTER, SWING = 0.6;
const refs: [number, string][] = [[1, 'goblin'], [10, 'scorpion'], [20, 'dark_wizard'], [30, 'hill_giant'], [40, 'saltback_stalker'], [50, 'moss_guardian'], [60, 'slag_brute'], [70, 'lesser_demon']];
const ammoTier = (lvl: number) => [...C.AMMO_TIERS].reverse().find((a) => a.fromReq <= lvl)!;
const ammoFor = (lvl: number, weaponId: string) => (String((ITEMS as Record<string, AnyItem>)[weaponId].iconKind) === 'crossbow' ? ammoTier(lvl).bolt : ammoTier(lvl).arrow);
const madeCost = (id: string) => { const r = C.NEW_RECIPES.find((x) => x.output === id); return r ? Object.entries(r.input).reduce((t, [i, q]) => t + sell(i) * q, 0) / (r.outputQty || 1) : items[id].price; };
const f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2), pc = (x: number) => (x * 100).toFixed(0) + '%';

p('5a. Damage per second (damage per 0.6 s swing / 0.6) against a monster of the level; x = times melee. Melee is identical before and after.');
p('level target             melee | TODAY ranged (bronze)   magic (best spell) | AFTER ranged bronze   ranged, arrow of its level   magic (best spell) | fastest / slowest today -> after');
const band: { lvl: number; r: number; g: number }[] = [];
for (const [lvl, t] of refs) {
  const tm = monsters[t], m = dps('melee', lvl, tm), m2 = dps('melee', lvl, tm, { cfg: AFTER });
  check(m.avg === m2.avg && m.maxHit === m2.maxHit, `melee at ${lvl} unchanged by the rebalance`);
  const r0 = dps('ranged', lvl, tm), g0 = dps('magic', lvl, tm);
  const rb = dps('ranged', lvl, tm, { cfg: AFTER }), am = ammoFor(lvl, rb.ids[0]), ra = dps('ranged', lvl, tm, { cfg: AFTER, ammo: C.AMMO[am].power });
  const g1 = dps('magic', lvl, tm, { cfg: AFTER });
  const sp0 = Math.max(m.avg, r0.avg, g0.avg) / Math.min(m.avg, r0.avg, g0.avg), sp1 = Math.max(m.avg, ra.avg, g1.avg) / Math.min(m.avg, ra.avg, g1.avg);
  p(`${String(lvl).padStart(3)}   ${t.padEnd(17)} ${f1(m.avg / SWING).padStart(5)} | ${f1(r0.avg / SWING).padStart(5)} x${f2(r0.avg / m.avg)}            ${f1(g0.avg / SWING).padStart(5)} x${f2(g0.avg / m.avg)}       | ${f1(rb.avg / SWING).padStart(5)} x${f2(rb.avg / m.avg)}          ${f1(ra.avg / SWING).padStart(5)} x${f2(ra.avg / m.avg)} ${am.padEnd(13)}    ${f1(g1.avg / SWING).padStart(5)} x${f2(g1.avg / m.avg)} ${g1.spell.padEnd(13)} | ${f2(sp0)} -> ${f2(sp1)}`);
  if (lvl >= 20) band.push({ lvl, r: ra.avg / m.avg, g: g1.avg / m.avg });
}
{
  const B = C.STYLE_BAND, rs = band.map((b) => b.r), gs = band.map((b) => b.g);
  p(`  levels 20 to 70 after: ranged ${f2(Math.min(...rs))} to ${f2(Math.max(...rs))} of melee (band ${B.ranged.join(' to ')}), magic ${f2(Math.min(...gs))} to ${f2(Math.max(...gs))} (band ${B.magic.join(' to ')}); the fastest style at most ${f2(Math.max(...band.map((b) => Math.max(1, b.r, b.g) / Math.min(1, b.r, b.g))))} times the slowest (bound ${B.fastestOverSlowest}); today up to ${f2(Math.max(...refs.filter(([l]) => l >= 20).map(([l, t]) => { const a = dps('melee', l, monsters[t]).avg, b = dps('ranged', l, monsters[t]).avg, c = dps('magic', l, monsters[t]).avg; return Math.max(a, b, c) / Math.min(a, b, c); })))}`);
  for (const b of band) {
    check(b.r >= B.ranged[0] && b.r <= B.ranged[1], `ranged at ${b.lvl} in band: ${f2(b.r)}`);
    check(b.g >= B.magic[0] && b.g <= B.magic[1], `magic at ${b.lvl} in band: ${f2(b.g)}`);
    check(Math.max(1, b.r, b.g) / Math.min(1, b.r, b.g) <= B.fastestOverSlowest, `fastest over slowest at ${b.lvl}`);
  }
}
p('  kits (weapon, body, legs) and max hits, today -> after:');
for (const lvl of [20, 40, 70]) {
  const tm = monsters[refs.find(([l]) => l === lvl)![1]];
  const m = dps('melee', lvl, tm), r0 = dps('ranged', lvl, tm), ra = dps('ranged', lvl, tm, { cfg: AFTER, ammo: C.AMMO[ammoFor(lvl, r0.ids[0])].power }), g0 = dps('magic', lvl, tm), g1 = dps('magic', lvl, tm, { cfg: AFTER });
  p(`    ${lvl}: melee ${m.ids.join(', ')} max hit ${m.maxHit} (defence bonus ${m.def}) | ranged ${r0.ids.join(', ')} max hit ${r0.maxHit} -> ${ra.maxHit} (defence ${r0.def}) | magic ${g0.ids.join(', ')} max hit ${g0.maxHit} -> ${g1.maxHit} (defence ${g0.def})`);
}

p();
p('5b. What a kill costs to make, against the coins it drops. "bought" is the shop price; "made" prices each arrow or rune at what its inputs sell for.');
p('    After the rebalance ice burst and blood barrage take one rune of each kind (today two); wind strike and fire bolt keep their runes.');
p('level target            coins | ranged TODAY bronze | AFTER bronze bought | AFTER arrow of its level: bought, made | magic TODAY best spell: bought, bound | AFTER best spell: bought, bound');
for (const [lvl, t] of refs) {
  const tm = monsters[t], coins = meanCoin(tm);
  const r0 = dps('ranged', lvl, tm), rb = dps('ranged', lvl, tm, { cfg: AFTER }), am = ammoFor(lvl, rb.ids[0]), ra = dps('ranged', lvl, tm, { cfg: AFTER, ammo: C.AMMO[am].power });
  const g0 = dps('magic', lvl, tm), g1 = dps('magic', lvl, tm, { cfg: AFTER, runes: C.SPELL_RUNES_AFTER });
  const bound = (g: typeof g0) => Object.entries(g.runes).reduce((s, [rn, q]) => s + madeCost(rn) * q, 0);
  const k = (x: number) => `${x.toFixed(0).padStart(5)} GP ${pc(x / coins).padStart(4)}`;
  p(`${String(lvl).padStart(3)}   ${t.padEnd(17)} ${coins.toFixed(0).padStart(4)} | ${k(tm.hp / r0.avg * 8)} | ${k(tm.hp / rb.avg * 8)} | ${am.padEnd(13)} ${k(tm.hp / ra.avg * items[am].price)}, ${k(tm.hp / ra.avg * madeCost(am))} | ${g0.spell.padEnd(13)} ${k(tm.hp / g0.avg * g0.cost)}, ${k(tm.hp / g0.avg * bound(g0))} | ${k(tm.hp / g1.avg * g1.cost)}, ${k(tm.hp / g1.avg * bound(g1))}`);
}
p('  every spell a caster of the level can cast, AFTER: times melee, then cost per kill bought / bound as a share of the kill\'s coins');
for (const [lvl, t] of refs.filter(([l]) => l >= 20)) {
  const tm = monsters[t], coins = meanCoin(tm), m = dps('melee', lvl, tm);
  p(`    ${String(lvl).padStart(3)} ${t.padEnd(17)} ` + combatSpells().filter((x) => x.req <= lvl).map((sp) => { const g = dps('magic', lvl, tm, { cfg: AFTER, spell: sp.id, runes: C.SPELL_RUNES_AFTER }); const bd = Object.entries(g.runes).reduce((s, [rn, q]) => s + madeCost(rn) * q, 0); return `${sp.id} x${f2(g.avg / m.avg)} ${pc(tm.hp / g.avg * g.cost / coins)}/${pc(tm.hp / g.avg * bd / coins)}`; }).join(' | '));
}
p('  the same TODAY (two runes of each for the big spells):');
for (const [lvl, t] of refs.filter(([l]) => l >= 20)) {
  const tm = monsters[t], coins = meanCoin(tm), m = dps('melee', lvl, tm);
  p(`    ${String(lvl).padStart(3)} ${t.padEnd(17)} ` + combatSpells().filter((x) => x.req <= lvl).map((sp) => { const g = dps('magic', lvl, tm, { spell: sp.id }); const bd = Object.entries(g.runes).reduce((s, [rn, q]) => s + madeCost(rn) * q, 0); return `${sp.id} x${f2(g.avg / m.avg)} ${pc(tm.hp / g.avg * g.cost / coins)}/${pc(tm.hp / g.avg * bd / coins)}`; }).join(' | '));
}
p('  arrow and bolt grades: max-hit points added, shop price, made cost each (inputs at sale value), smithing level of the recipe');
for (const [id, a] of Object.entries(C.AMMO)) { const r = C.NEW_RECIPES.find((x) => x.output === id); p(`    ${id.padEnd(14)} +${a.power}  shop ${String(items[id].price).padStart(2)} GP  made ${r ? madeCost(id).toFixed(1) : '(no recipe)'}${r ? `  Smithing ${r.req}, ${r.outputQty} from one bar` : ''}`); }
p('  what a better arrow buys at level 70 (lesser demon): ' + ['bronze_arrow', 'iron_arrow', 'mithril_arrow', 'rune_arrow'].map((id) => { const tm = monsters.lesser_demon, g = dps('ranged', 70, tm, { cfg: AFTER, ammo: C.AMMO[id].power }), b = dps('ranged', 70, tm, { cfg: AFTER }); return `${id} max hit ${g.maxHit} (${g.avg >= b.avg ? '+' : ''}${pc(g.avg / b.avg - 1)}) ${(tm.hp / g.avg * items[id].price).toFixed(0)} GP a kill bought, ${(tm.hp / g.avg * madeCost(id)).toFixed(0)} made`; }).join('; '));

p();
p('5c. Outside the standard kit (information): every tier allowed (special sets and uniques), weapon + body + legs; times melee, today -> after with the arrow of the level');
for (const lvl of [50, 60, 70, 80, 90]) {
  const tm = monsters.lesser_demon, m = dps('melee', lvl, tm, { special: true }), r0 = dps('ranged', lvl, tm, { special: true }), g0 = dps('magic', lvl, tm, { special: true });
  const ra = dps('ranged', lvl, tm, { cfg: AFTER, special: true, ammo: C.AMMO[ammoFor(lvl, r0.ids[0])].power }), g1 = dps('magic', lvl, tm, { cfg: AFTER, special: true });
  p(`    ${lvl}: melee ${m.ids[0]} ${f1(m.avg / SWING)} | ranged ${r0.ids[0]} x${f2(r0.avg / m.avg)} -> x${f2(ra.avg / m.avg)} | magic ${g0.ids[0]} x${f2(g0.avg / m.avg)} -> x${f2(g1.avg / m.avg)}`);
}

p();
p('5e. Training speed: experience per hour of continuous swings in the style\'s own skill (melee: 4 a point of damage on one skill; ranged: 4 a point; magic: 3 a point plus 0.4 of the spell\'s experience on a hit), today -> after');
for (const [lvl, t] of refs.filter(([l]) => l >= 20)) {
  const tm = monsters[t], perHour = 3600 / SWING;
  const m = dps('melee', lvl, tm), r0 = dps('ranged', lvl, tm), rb = dps('ranged', lvl, tm, { cfg: AFTER }), ra = dps('ranged', lvl, tm, { cfg: AFTER, ammo: C.AMMO[ammoFor(lvl, r0.ids[0])].power });
  const mx = (cfg: StyleCfg) => { const g = dps('magic', lvl, tm, { cfg }), sp = SPELLS.find((x) => x.id === g.spell)!; const { acc } = profileOf('magic', lvl, getEquipmentBonuses(kitOf('magic', lvl).s), { cfg }); const hc = Math.min(0.94, Math.max(0.22, acc / (acc + (tm.def * 1.1 + 4) * 0.75))); return (g.avg * 3 + hc * sp.xp * 0.4) * perHour; };
  const k = (x: number) => (x / 1000).toFixed(0) + 'k';
  p(`    ${String(lvl).padStart(3)}: melee ${k(m.avg * 4 * perHour)} | ranged ${k(r0.avg * 4 * perHour)} -> ${k(rb.avg * 4 * perHour)} with bronze arrows (${pc(rb.avg / r0.avg - 1)}), ${k(ra.avg * 4 * perHour)} with the arrow of the level (${pc(ra.avg / r0.avg - 1)}) | magic ${k(mx(C.STYLE_TODAY))} -> ${k(mx(AFTER))} (${pc(mx(AFTER) / mx(C.STYLE_TODAY) - 1)})`);
}

p();
p('5d. The values the declared test replacements take (Stage 3, tests/combat-profile.test.ts and tests/entry-staff.test.ts), level 1, no other gear:');
{
  const rngBon = (ITEMS as Record<string, AnyItem>).shortbow.rng as number, magBon = (ITEMS as Record<string, AnyItem>).fire_staff.mag as number;
  const rangedMax = (cfg: StyleCfg, pray: number) => Math.max(2, Math.floor((cfg.rangedBase + 1 * 0.35 + rngBon * cfg.rangedGear) * pray));
  const magicMax = (cfg: StyleCfg, spell: number, mag: number, pray: number) => Math.max(3, Math.floor((spell + 1 * 0.22 + mag * 0.18) * cfg.magicScale * pray));
  p(`    shortbow on rapid: max hit ${rangedMax(C.STYLE_TODAY, 1)} -> ${rangedMax(AFTER, 1)}; with sharp_eye ${rangedMax(C.STYLE_TODAY, 1.2)} -> ${rangedMax(AFTER, 1.2)} (accuracy 29.4, unchanged)`);
  p(`    fire_staff, wind_strike: ${magicMax(C.STYLE_TODAY, 6, magBon, 1)} -> ${magicMax(AFTER, 6, magBon, 1)}; fire_bolt: ${magicMax(C.STYLE_TODAY, 13, magBon, 1)} -> ${magicMax(AFTER, 13, magBon, 1)}; wind_strike with mystic_might: ${magicMax(C.STYLE_TODAY, 6, magBon, 1.2)} -> ${magicMax(AFTER, 6, magBon, 1.2)} (accuracy 41.5, unchanged)`);
  p(`    hazel_staff (Stage 3's starter staff, magic bonus 4), wind_strike at Magic 1: ${magicMax(C.STYLE_TODAY, 6, 4, 1)} -> ${magicMax(AFTER, 6, 4, 1)} (accuracy 21.5, unchanged)`);
}

// ---------------------------------------------------------------- 6. placement against the merged world
h('6. Placement: people, nodes, camps and doors against the merged world (Stages 1 to 5)');
// R0: Stage 5's woods trees (isWalkable already blocks their cells). tests/woods-trees.test.ts also holds every resource
// node 4.5 from a tree centre (TARGET_CLEAR) and every camp's radius + 2 clear of one (CAMP_EXTRA); the same two rules here.
const treeCentres = WOODS_TREES.map(([i, j]) => [-118 + i + 0.5, -118 + j + 0.5]);
const nearestTree = (x: number, z: number) => Math.min(...treeCentres.map(([a, b]) => Math.hypot(a - x, b - z)));
const aggressive = CAMPS.filter((c) => c.aggressive);
const inAggro = (x: number, z: number) => aggressive.find((c) => Math.hypot(x - c.x, z - c.z) <= c.radius + 4);
const inSafe = (x: number, z: number) => SAFE_ZONES.find((s) => Math.hypot(x - s.x, z - s.z) <= s.radius);
const stations: [string, number, number][] = [['forge', 10, -4], ['east forge', 86, -16], ['store', -7, 5], ['east store', 78, -12], ['dunes store', 64, 62], ['bank', 2.2, 4.2], ['task master', 5.5, 8.5]];
const nearStation = (x: number, z: number) => Math.min(...stations.map(([, sx, sz]) => Math.hypot(x - sx, z - sz)));
for (const n of C.NPCS) {
  const ok = isWalkable(n.x, n.z), ag = inAggro(n.x, n.z), sf = inSafe(n.x, n.z);
  const pathD = Math.min(...PATHS.map((pp) => nearestOnPolyline(pp.points, n.x, n.z).d));
  p(`  ${n.name.padEnd(16)} (${n.x}, ${n.z}) walkable ${ok}, safe zone ${sf ? sf.id : 'no'}, aggressive camp ${ag ? ag.id : 'no'}, nearest station ${nearStation(n.x, n.z).toFixed(1)}, nearest path ${pathD.toFixed(1)}, height ${getTerrainHeight(n.x, n.z).toFixed(2)}`);
  check(ok && !ag && nearStation(n.x, n.z) >= 2.5, `${n.id} placement`);
}
for (const b of C.BENCHES) {
  const people = Math.min(...C.NPCS.map((n) => Math.hypot(n.x - b.x, n.z - b.z)));
  p(`  ${b.id.padEnd(16)} (${b.x}, ${b.z}) walkable ${isWalkable(b.x, b.z)}, aggressive camp ${inAggro(b.x, b.z)?.id || 'no'}, nearest station ${nearStation(b.x, b.z).toFixed(1)}, nearest person ${people.toFixed(1)}, safe zone ${inSafe(b.x, b.z)?.id || 'no'}`);
  check(isWalkable(b.x, b.z) && !inAggro(b.x, b.z) && nearStation(b.x, b.z) >= 2.5 && people >= 2.5, `${b.id} placement`);
}
for (const n of C.NEW_NODE_PLACEMENTS) {
  const ag = inAggro(n.x, n.z);
  let near = 99; for (let a = 0; a < 32; a++) for (const r of [1, 2, 3]) { const x = n.x + r * Math.cos(a * Math.PI / 16), z = n.z + r * Math.sin(a * Math.PI / 16); if (isWalkable(x, z)) near = Math.min(near, r); }
  const other = Math.min(...NODE_PLACEMENTS.map((q) => Math.hypot(q.x - n.x, q.z - n.z)));
  const tree = nearestTree(n.x, n.z);
  p(`  ${n.type.padEnd(16)} (${n.x}, ${n.z}) walkable ${isWalkable(n.x, n.z)}, walkable ground within ${near}, aggressive camp ${ag ? ag.id : 'no'}, nearest existing node ${other.toFixed(1)}, nearest woods tree ${tree.toFixed(1)}, safe zone ${inSafe(n.x, n.z)?.id || 'no'}`);
  check(isWalkable(n.x, n.z) && !ag && other >= 3 && tree >= 4.5 && Math.abs(n.x) <= 116 && Math.abs(n.z) <= 116, `${n.type} at ${n.x},${n.z}`);
}
const leash = (c: { x: number; z: number; radius: number }) => c.radius + 4;
const mk = (members: { x: number; z: number }[]) => { const cx = members.reduce((s, m) => s + m.x, 0) / members.length, cz = members.reduce((s, m) => s + m.z, 0) / members.length; return { x: cx, z: cz, radius: Math.ceil(Math.max(...members.map((m) => Math.hypot(m.x - cx, m.z - cz))) + 4.5) }; };
const ashCamp = CAMPS.find((c) => c.id === 'ashmantle')!;
const arenas = [{ id: 'ashmantle', x: ashCamp.x, z: ashCamp.z, radius: BOSSES.ashmantle.arenaRadius, margin: BOSS_ARENA_MARGIN }];
for (const c of C.NEW_CAMPS) {
  const circle = mk(c.members), r = (c as { arenaRadius?: number }).arenaRadius ?? circle.radius;
  const reach = (c as { arenaRadius?: number }).arenaRadius ? r + 6 : leash(circle);
  const gapCamp = Math.min(...CAMPS.map((o) => Math.hypot(o.x - circle.x, o.z - circle.z) - leash(o) - reach));
  const gapSafe = Math.min(...SAFE_ZONES.map((s) => Math.hypot(s.x - circle.x, s.z - circle.z) - s.radius - reach));
  const gapPath = Math.min(...PATHS.map((pp) => nearestOnPolyline(pp.points, circle.x, circle.z).d - pp.halfWidth - reach));
  const gapNode = Math.min(...[...NODE_PLACEMENTS, ...C.NEW_NODE_PLACEMENTS].map((n) => Math.hypot(n.x - circle.x, n.z - circle.z) - reach));
  const gapArena = Math.min(...arenas.map((a) => Math.hypot(a.x - circle.x, a.z - circle.z) - a.radius - a.margin - reach));
  let open = 0, cells = 0; for (let x = -reach; x <= reach; x++) for (let z = -reach; z <= reach; z++) if (Math.hypot(x, z) <= reach) { cells++; if (isWalkable(circle.x + x, circle.z + z)) open++; }
  const hs: number[] = []; for (let x = -r; x <= r; x += 1) for (let z = -r; z <= r; z += 1) if (Math.hypot(x, z) <= r) hs.push(getTerrainHeight(circle.x + x, circle.z + z));
  const gapTree = nearestTree(circle.x, circle.z) - circle.radius - 2;
  p(`  camp ${c.id.padEnd(14)} centre (${circle.x.toFixed(1)}, ${circle.z.toFixed(1)}) radius ${r}, reach ${reach}: gaps camp ${gapCamp.toFixed(1)}, safe zone ${gapSafe.toFixed(1)}, path ${gapPath.toFixed(1)}, node ${gapNode.toFixed(1)}, Ashmantle arena ${gapArena.toFixed(1)}, woods tree ${gapTree.toFixed(1)}; open cells ${open}/${cells}; height range ${(Math.max(...hs) - Math.min(...hs)).toFixed(1)}; region ${WORLD_REGIONS.find((g) => Math.hypot(g.x - circle.x, g.z - circle.z) <= g.radius)?.id || 'none'}`);
  check(gapCamp >= 0 && gapSafe >= 0 && gapPath >= 0 && gapNode >= 0 && gapArena >= 0 && gapTree > 0 && open === cells && c.members.every((m) => isWalkable(m.x, m.z)), `camp ${c.id}`);
}
{
  const cs = C.NEW_CAMPS.map((c) => ({ id: c.id, k: mk(c.members), arena: (c as { arenaRadius?: number }).arenaRadius }));
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const ri = cs[i].arena ? cs[i].arena! + 6 : leash(cs[i].k), rj = cs[j].arena ? cs[j].arena! + 6 : leash(cs[j].k);
    const gap = Math.hypot(cs[i].k.x - cs[j].k.x, cs[i].k.z - cs[j].k.z) - ri - rj;
    p(`  new camps ${cs[i].id} and ${cs[j].id}: gap ${gap.toFixed(1)}`);
    check(gap >= 0, `new camps ${cs[i].id} and ${cs[j].id} overlap`);
  }
  for (const n of C.NPCS) for (const c of cs) check(Math.hypot(n.x - c.k.x, n.z - c.k.z) > (c.arena ? c.arena + 6 : leash(c.k)), `${n.id} inside new camp ${c.id}`);
  const corin = C.NPCS.find((n) => n.id === 'corin_ashby')!, cc = cs.find((c) => c.id === 'cinder_circle')!;
  p(`  Corin Ashby to cinder_circle: ${Math.hypot(corin.x - cc.k.x, corin.z - cc.k.z).toFixed(1)} from its centre, ${(Math.hypot(corin.x - cc.k.x, corin.z - cc.k.z) - leash(cc.k)).toFixed(1)} outside its leash`);
}
for (const d of C.DUNGEONS) {
  const ag = inAggro(d.door.x, d.door.z), near = Math.min(...NODE_PLACEMENTS.map((q) => Math.hypot(q.x - d.door.x, q.z - d.door.z)));
  const newCamp = Math.min(...C.NEW_CAMPS.map((c) => { const k = mk(c.members); return Math.hypot(k.x - d.door.x, k.z - d.door.z) - leash(k); }));
  const ar = Math.min(...arenas.map((a) => Math.hypot(a.x - d.door.x, a.z - d.door.z) - a.radius - a.margin));
  p(`  door ${d.id.padEnd(16)} (${d.door.x}, ${d.door.z}) walkable ${isWalkable(d.door.x, d.door.z)}, aggressive camp ${ag ? ag.id : 'no'}, nearest node ${near.toFixed(1)}, new camps ${newCamp.toFixed(1)}, Ashmantle arena ${ar.toFixed(1)}, safe zone ${inSafe(d.door.x, d.door.z)?.id || 'no'}, height ${getTerrainHeight(d.door.x, d.door.z).toFixed(2)}, region ${WORLD_REGIONS.find((g) => Math.hypot(g.x - d.door.x, g.z - d.door.z) <= g.radius)?.id || 'none'}`);
  check(isWalkable(d.door.x, d.door.z) && !ag && near >= 3 && newCamp >= 0 && ar >= 0, `door ${d.id}`);
}

// ---------------------------------------------------------------- 7. dungeon geometry
h('7. Dungeons: geometry, connectivity and size of each zone');
for (const d of C.DUNGEONS) {
  const inRect = (r: C.Rect, x: number, z: number) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];
  const walk = (closed: boolean) => (x: number, z: number) => Object.values(d.rooms).some((r) => inRect(r, x, z)) && !(closed && d.gates.some((g) => inRect(g.rect, x, z)));
  const n = d.size, grid = (closed: boolean) => { const w = walk(closed), c = new Uint8Array(n * n); for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) if (w(x + 0.5, z + 0.5)) c[z * n + x] = 1; return c; };
  const flood = (c: Uint8Array) => { const seen = new Uint8Array(n * n), q = [Math.floor(d.entry[1]) * n + Math.floor(d.entry[0])]; seen[q[0]] = 1; while (q.length) { const i = q.pop()!, x = i % n, z = (i - x) / n; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Z = z + dz; if (X < 0 || Z < 0 || X >= n || Z >= n) continue; const j = Z * n + X; if (c[j] && !seen[j]) { seen[j] = 1; q.push(j); } } } return seen; };
  const open = grid(false), shut = grid(true), so = flood(open), ss = flood(shut);
  const cells = open.reduce((s, v) => s + v, 0), reachOpen = so.reduce((s, v) => s + v, 0);
  const boss = d.camps.find((c) => c.arenaRadius)!, b = boss.members[0], lair = d.rooms[boss.room];
  const at = (x: number, z: number, s: Uint8Array) => s[Math.floor(z) * n + Math.floor(x)] === 1;
  p(`  ${d.name}: origin (${d.origin}), ${n} x ${n} cells, ${cells} open, all reachable with the gate open ${reachOpen === cells}; boss cell reachable with the gate shut ${at(b.x, b.z, ss)}; rooms ${Object.keys(d.rooms).length}; monsters ${d.camps.reduce((s, c) => s + c.members.length, 0)}`);
  check(reachOpen === cells && !at(b.x, b.z, ss) && at(d.chest[0], d.chest[1], so), `${d.id} connectivity`);
  for (const c of d.camps) for (const m of c.members) check(inRect(d.rooms[c.room], m.x, m.z) && !!monsters[m.type], `${d.id} ${c.id} member ${m.type} inside its room`);
  for (const nd of d.nodes) check(at(nd.x, nd.z, so), `${d.id} node on open floor`);
  const fit = Math.min(b.x - lair[0], lair[2] - b.x, b.z - lair[1], lair[3] - b.z);
  p(`    boss room: home (${b.x}, ${b.z}), arena radius ${boss.arenaRadius}, nearest wall ${fit}; farthest corner from home ${Math.hypot(Math.max(b.x - lair[0], lair[2] - b.x), Math.max(b.z - lair[1], lair[3] - b.z)).toFixed(1)} (the boss takes damage only from within arena + 6 = ${boss.arenaRadius! + 6})`);
  check(fit >= boss.arenaRadius!, `${d.id} arena fits its room`);
  check(Object.values(d.rooms).every((r) => r[0] >= 2 && r[1] >= 2 && r[2] <= n - 2 && r[3] <= n - 2), `${d.id} rooms inside the zone`);
  check(Math.min(...Object.values(d.rooms).map((r) => Math.min(r[2] - r[0], r[3] - r[1]))) >= 6, `${d.id} no room or corridor under 6 wide`);
  // Critique fix: Stage 5's camera far plane (CAMERA_FAR) and horizon apron out to HORIZON_APRON.outer around the origin
  // (src/data/look.ts; R0 reads the constants), and the camera stands up to 26 from the hero. The nearest zone cell, less the
  // camera's reach, must be farther than the far plane from the apron's outer edge. (The sky dome follows the camera and is
  // hidden in a zone: Z6.)
  const near = Math.min(...[[d.origin[0], d.origin[1]], [d.origin[0], d.origin[1] + n], [d.origin[0] + n, d.origin[1]], [d.origin[0] + n, d.origin[1] + n]].map(([x, z]) => Math.hypot(x, z)), Math.abs(d.origin[0])) - 26 - HORIZON_APRON.outer;
  p(`    nearest zone cell to the Stage 5 horizon apron (radius ${HORIZON_APRON.outer}), less the camera's 26: ${near.toFixed(0)} (camera far plane ${CAMERA_FAR})`);
  check(near > CAMERA_FAR, `${d.id} beyond Stage 5's camera far plane (${CAMERA_FAR}) from the horizon apron: ${near.toFixed(0)}`);
}
check(Math.abs(C.DUNGEONS[0].origin[1] - C.DUNGEONS[1].origin[1]) - 112 > HORIZON_APRON.outer, 'zones well apart');

// ---------------------------------------------------------------- 8. what a run takes and pays
h('8. A dungeon run against open ground: coin per second, the same overheads on both sides');
// Both sides: the model's fighter, no rests, no deaths. Open ground: each kill costs its fight plus 1.5 s to reach the next
// monster, or the respawn wait shared by the camp, whichever is longer (Stage 3 design 4.2). Dungeon: the fights, plus the
// walk through the rooms at 11.5 units a second; nothing respawns, so there is no wait.
const campSize: Record<string, number> = {};
for (const c of CAMPS) for (const m of c.members) campSize[m.type] = Math.max(campSize[m.type] || 0, c.members.filter((x) => x.type === m.type).length);
Object.assign(campSize, { saltback_stalker: 3, thornwatch_marksman: 2 });
for (const c of C.NEW_CAMPS) for (const m of c.members) campSize[m.type] = c.members.length;
// Critique fix: goods (every non-bone item drop at sale value) are counted on both sides. The first draft counted only coins
// for monsters, which left out the Kiln Warden's two Kilnglass Shards (1,560 GP) while the chest's shards were counted.
const goodsOf = (m: M) => m.drops.filter((d) => d.id && !['bones', 'big_bones', 'dragon_bones'].includes(d.id)).reduce((s, d) => s + d.chance * (d.qty || 1) * sell(d.id!), 0);
function openBest(lvl: number) {
  let bestRate = 0, bestName = '';
  for (const [k, n] of Object.entries(campSize)) {
    // Critique fix: a hero with every fighting skill at `lvl` is combat ~lvl+9 and fights monsters up to ten levels above its skills
    // (the Cinder Adept at 52 for a hero at 45). The first draft compared monster level with skill level and left the Adept out.
    const mon = monsters[k]; if (!mon || mon.level > lvl + 10 || (C.BOSSES as Record<string, unknown>)[k] || k === 'elvarg_dragon') continue;
    const kt = (mon.hp / dps('melee', lvl, mon).avg) * 0.6, rate = (meanCoin(mon) + goodsOf(mon)) / Math.max(kt + 1.5, (8.35 + kt) / n);
    if (rate > bestRate) { bestRate = rate; bestName = mon.name; }
  }
  return { rate: bestRate, name: bestName };
}
for (const d of C.DUNGEONS) {
  const lvl = d.id === 'underkiln' ? 70 : 45;
  let hp = 0, secs = 0, coins = 0;
  for (const c of d.camps) for (const m of c.members) { const mon = monsters[m.type]; const k = dps('melee', lvl, mon); hp += mon.hp; secs += (mon.hp / k.avg) * 0.6; coins += meanCoin(mon) + goodsOf(mon); }
  const rooms = Object.entries(d.rooms).filter(([id]) => !/^c\d$/.test(id)).map(([, r]) => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2]);
  let walkUnits = 0; for (let i = 1; i < rooms.length; i++) walkUnits += Math.hypot(rooms[i][0] - rooms[i - 1][0], rooms[i][1] - rooms[i - 1][1]);
  walkUnits *= 1.5; // doglegs, pulls and the way back to a side room
  const chest = C.CHESTS[d.id];
  // every clear: the fixed part and the coins, plus each rare entry at its chance (equipment at its sale value)
  const chestGp = (chest.runGp[0] + chest.runGp[1]) / 2 + chest.run.reduce((s, r) => s + sell(r.id) * (r.qty[0] + r.qty[1]) / 2, 0) + chest.rare.reduce((s, r) => s + r.chance * r.qty * sell(r.id), 0);
  const total = secs + walkUnits / 11.5, open = openBest(lvl);
  p(`  ${d.name}, every fighting skill at ${lvl}: ${hp} hitpoints in ${d.camps.reduce((s, c) => s + c.members.length, 0)} monsters; fighting ${Math.round(secs)} s and walking ${Math.round(walkUnits)} units = ${(total / 60).toFixed(1)} min model-optimal (a person about double; never asserted)`);
  p(`    pays ${coins.toFixed(0)} coins and goods from monsters + ${chestGp.toFixed(0)} from the chest at sale value = ${((coins + chestGp) / total).toFixed(1)} GP/s; best open ground at that level: ${open.name}, ${open.rate.toFixed(1)} GP/s; ratio ${(((coins + chestGp) / total) / open.rate).toFixed(2)}. Nothing is paid once: a chest has no first-clear reward (design 7.6)`);
  check((coins + chestGp) / total <= 0.9 * open.rate, `${d.id} pays under 90% of open ground`);
}

// ---------------------------------------------------------------- 8b. drop tables and expected runs
h('8b. Drop tables: what a dungeon and a boss can give, the chance of each entry, and how many runs a specific thing takes');
// Owner, 2026-11-14: "a dungeon is a dungeon; sometimes you have to do it N times to drop a specific item". No lockout, no
// first-clear reward: every entry below is rolled on every clear (chest) or every kill (boss).
const runsFor = (pp: number, q: number) => Math.ceil(Math.log(1 - q) / Math.log(1 - pp));
for (const d of C.DUNGEONS) {
  const ch = C.CHESTS[d.id], boss = monsters[d.camps.find((c) => c.arenaRadius)!.members[0].type];
  p(`  ${d.name}, the chest, every clear: ${ch.run.map((r) => `${r.qty[0] === r.qty[1] ? r.qty[0] : r.qty.join(' to ')} ${items[r.id].name}`).join(', ')}, ${ch.runGp.join(' to ')} GP`);
  for (const r of ch.rare) {
    p(`    chance ${pc(r.chance).padStart(4)}: ${r.qty} ${items[r.id].name}${items[r.id].type === 'equip' ? ' (equipment)' : ''}: on average 1 clear in ${(1 / r.chance).toFixed(0)}; half of all players have it within ${runsFor(r.chance, 0.5)} clears, nine in ten within ${runsFor(r.chance, 0.9)}`);
    if (items[r.id].type === 'equip') check(r.chance <= 0.05, `${d.id} chest: ${r.id} above Stage 3's boss cap of 0.05`);
    check(!!items[r.id], `${d.id} chest rare ${r.id} exists`);
  }
  p(`  ${boss.name}, every kill: ${boss.drops.filter((x) => x.chance >= 1).map((x) => x.gp ? `${x.gp.join(' to ')} GP` : `${x.qty || 1} ${items[x.id!].name}`).join(', ')}`);
  for (const x of boss.drops.filter((y) => y.chance < 1 && y.id)) p(`    chance ${pc(x.chance).padStart(4)}: ${x.qty || 1} ${items[x.id!].name}: on average 1 kill in ${(1 / x.chance).toFixed(0)}`);
}
{
  const mj = monsters.marrowjaw;
  p(`  ${mj.name} (open ground, back every ${C.BOSSES.marrowjaw.respawnSecs} s), every kill: ${mj.drops.filter((x) => x.chance >= 1).map((x) => x.gp ? `${x.gp.join(' to ')} GP` : `${x.qty || 1} ${items[x.id!].name}`).join(', ')}`);
  for (const x of mj.drops.filter((y) => y.chance < 1 && y.id)) p(`    chance ${pc(x.chance).padStart(4)}: ${x.qty || 1} ${items[x.id!].name}: on average 1 kill in ${(1 / x.chance).toFixed(0)}`);
  const both = (pp: number) => 2 / pp - 1 / (2 * pp - pp * pp);
  const bb = C.CHESTS.underkiln.rare.find((r) => r.id === 'bloodbark_top')!.chance;
  p(`  both Bloodbark pieces from the Underkiln chest: ${both(bb).toFixed(0)} clears on average`);
}
for (const ch of C.CHASES) {
  // distribution of the count after n runs, capped at `need`
  let dist = new Array(ch.need + 1).fill(0); dist[0] = 1;
  const step = (dd: number[]) => { let cur = dd.map(() => 0); dd.forEach((pr, k) => { cur[Math.min(ch.need, k + ch.perRun.always)] += pr; }); for (const c of ch.perRun.chances) { const nx = cur.map(() => 0); cur.forEach((pr, k) => { nx[k] += pr * (1 - c.chance); nx[Math.min(ch.need, k + c.qty)] += pr * c.chance; }); cur = nx; } return cur; };
  let expected = 0, n = 0, half = 0, nine = 0;
  while (dist[ch.need] < 1 - 1e-12 && n < 10000) { expected += 1 - dist[ch.need]; dist = step(dist); n++; if (!half && dist[ch.need] >= 0.5) half = n; if (!nine && dist[ch.need] >= 0.9) nine = n; }
  const mean = ch.perRun.always + ch.perRun.chances.reduce((s, c) => s + c.qty * c.chance, 0);
  p(`  ${ch.what}: ${mean.toFixed(1)} a clear on average (${ch.perRun.always} always${ch.perRun.chances.map((c) => `, ${c.qty} more at ${pc(c.chance)}`).join('')}): ${expected.toFixed(1)} clears on average; half of all players within ${half}, nine in ten within ${nine}; never more than ${Math.ceil(ch.need / ch.perRun.always)} (the guaranteed part alone)`);
  check(ch.perRun.always >= 1, `${ch.what}: a guaranteed part bounds bad luck`);
}
{
  // the chase table must describe the real tables
  const ch = C.CHESTS.underkiln, w = monsters.kiln_warden;
  const always = ch.run.find((r) => r.id === 'kiln_shard')!.qty[0];
  const chances = [...ch.rare.filter((r) => r.id === 'kiln_shard').map((r) => ({ qty: r.qty, chance: r.chance })), ...w.drops.filter((x) => x.id === 'kiln_shard' || x.id === 'wyrmsteel_ingot').map((x) => ({ qty: x.qty || 1, chance: x.chance }))];
  for (const c of C.CHASES) check(c.perRun.always === always && JSON.stringify(c.perRun.chances) === JSON.stringify(chances), `${c.what}: CHASES matches the chest and the Kiln Warden's table`);
  p('  (a Wyrmsteel Ingot from the Kiln Warden counts as one Kilnglass: it is a shard and a runite bar already smelted.)');
  for (const [k, m] of Object.entries(C.NEW_MONSTERS)) for (const x of m.drops) if (x.id && items[x.id]?.type === 'equip') check(false, `${k} drops equipment ${x.id}: equipment may only come from a chest`);
}

// ---------------------------------------------------------------- 9. names
h('9. Names against the Stage 2 deny-list (tests/names.test.ts) and the two words the architecture test forbids in src/data');
const DENY = ['lumbridge', 'misthalin', 'varrock', 'kharid', 'korok', 'whispering', 'wilderness', 'gielinor', 'haven', 'plaza', 'dunes', 'oasis', 'sunscorched', 'sanctuary', 'highlands', 'obsidian', 'volcanic', 'crag', 'peak', 'emporium', 'bazaar', 'cathedral', 'river lum',
  'chicken', 'goblin', 'raider', 'scorpion', 'wizard', 'ranger', 'archer', 'giant', 'guardian', 'demon', 'dragon', 'elvarg', 'vannaka', 'shopkeeper', 'trade master',
  'runescape', 'osrs', 'oldschool', 'runewilds', 'hylian', 'hyrule', 'zelda', 'zora', 'breath of the wild', 'bandos', 'armadyl', 'saradomin', 'zamorak', 'guthix', 'barrows', 'dharok', 'torag', 'torva', 'justiciar', 'inquisitor', 'ancestral', 'abyssal', 'elysian', 'fierce deity',
  'sheikah', 'masori', 'karil', 'ahrim', 'proselyte', 'zulrah', 'kodai', 'neitiznot', 'tzkal', 'godsword', 'pegasian', 'ultor', 'tumeken', 'elidinis', "ava's", 'seers', 'nex', 'bloodbark', 'odium', 'document', 'window'];
// Recipes are named after the existing items they make; those names stay (owner, 2026-11-14) and are listed apart.
const fresh = [...Object.values(C.NEW_ITEMS).map((i) => i.name), ...Object.values(C.NEW_NODES).map((i) => i.name), ...Object.values(C.NEW_MONSTERS).map((i) => i.name), ...C.NPCS.map((n) => n.name), ...C.DUNGEONS.map((d) => d.name), ...C.STORY_QUESTS.map((q) => q.name), ...C.OTHER_NAMES];
const hits = fresh.map((n) => [n, DENY.filter((t) => n.toLowerCase().includes(t))] as const).filter(([, t]) => t.length);
p(`  ${fresh.length} new names, ${new Set(fresh).size} distinct; deny-list hits: ${hits.map(([n, t]) => `${n} [${t}]`).join('; ') || 'none'}`);
check(hits.length === 0 && new Set(fresh).size === fresh.length, 'names');
const borrowed = C.NEW_RECIPES.map((r) => [r.name, DENY.filter((t) => r.name.toLowerCase().includes(t))] as const).filter(([, t]) => t.length);
p(`  recipe names that repeat an existing item's borrowed word (allowed, listed): ${borrowed.map(([n]) => n).join('; ') || 'none'}`);
p(`  new ids: ${Object.keys(C.NEW_ITEMS).length} items, ${Object.keys(C.NEW_NODES).length} nodes, ${C.NEW_RECIPES.length} recipes, ${Object.keys(C.NEW_MONSTERS).length} monster types, ${C.STORY_QUESTS.length} story quests, ${C.NPCS.length} people, ${C.DUNGEONS.length} dungeons, 2 skills`);
for (const id of [...Object.keys(C.NEW_ITEMS), ...Object.keys(C.NEW_NODES), ...Object.keys(C.NEW_MONSTERS)]) check(!(id in (ITEMS as object)) && !(id in (MONSTER_TYPES as object)) && !(id in (RESOURCE_NODES_DEF as object)), `id ${id} is free`);
for (const r of C.NEW_RECIPES) check(!recipesToday.some((x) => x.id === r.id), `recipe id ${r.id} is free`);

// ---------------------------------------------------------------- 10. the save
h('10. Save: size of the new optional block at its bounds');
const statKeys = [...Object.keys(monsters).map((k) => 'kill:' + k), ...[...Object.values(RESOURCE_NODES_DEF as never as Record<string, { item: string }>), ...Object.values(C.NEW_NODES)].map((n) => 'gather:' + n.item), ...recipesS6.map((r) => 'craft:' + r.id), ...C.NPCS.map((n) => 'talk:' + n.id), ...C.DUNGEONS.map((d) => 'clear:' + d.id), 'deaths', 'vows', 'shrines'];
const worstBlock = {
  story: Object.fromEntries(C.STORY_QUESTS.map((q) => [q.id, 9])),
  stats: Object.fromEntries(statKeys.map((k) => [k, 2147483647])),
  diary: C.DIARY_REGIONS.flatMap((r) => C.DIARY_TIERS.map((t) => `${r}:${t.id}`)),
  dungeons: Object.fromEntries(C.DUNGEONS.map((d) => [d.id, { clears: 2147483647, best: 2147483647 }])),
  bossDownUntil: Object.fromEntries(['ashmantle', 'marrowjaw'].map((k) => [k, 9999999999999]))
};
const base = serializeState(createDefaultState(), null, null).length;
p(`  stat keys ${statKeys.length}; diary tiers ${worstBlock.diary.length}; diary tasks ${C.DIARY_REGIONS.length * C.DIARY_TIERS.length * C.DIARY_TASKS_PER_TIER}`);
p(`  default save today ${base} bytes; the new block at every bound ${JSON.stringify(worstBlock).length} bytes; two new skills add about ${JSON.stringify({ crafting: { xp: 13034431, lvl: 99 }, runebinding: { xp: 13034431, lvl: 99 } }).length} bytes`);
check(JSON.stringify(worstBlock).length < 12000, 'progress block under 12 kB');

// ---------------------------------------------------------------- 11. hours
h('11. Where a player stands at hours 3, 10 and 30 (estimates from Stage 3 section 5.5; never asserted)');
const xpAt = (l: number) => OSRS_XP_TABLE[l];
p(`  Stage 3 route A3 at 1x, model-optimal: adamant (level 30) at 56 min, rune (40) at 1.8 h, dragon (60) at 5.4 h; a real player about double.`);
p(`  XP for Attack: level 30 ${xpAt(30)}, 40 ${xpAt(40)}, 50 ${xpAt(50)}, 60 ${xpAt(60)}, 70 ${xpAt(70)}, 80 ${xpAt(80)}`);
{
  // a level-60+ melee fighter on lesser demons, controlled style: 1.4 / 1.3 / 1.3 XP per point of damage to Attack / Strength / Defence
  let lvl = 60, hours = 5.4, xp = xpAt(60);
  const marks: string[] = [];
  while (hours < 15.01) {
    const d = monsters.lesser_demon, k = dps('melee', lvl, d), kt = (d.hp / k.avg) * 0.6, cycle = Math.max(kt + 1.5, (8.35 + kt) / 2) * 1.25; // 25% rest and walking
    const perHour = (3600 / cycle) * d.hp * 1.3;
    xp += perHour * 0.1; hours += 0.1; while (xp >= xpAt(lvl + 1)) lvl++;
    if (Math.abs(hours - 10) < 0.05 || Math.abs(hours - 15) < 0.05) marks.push(`model hour ${hours.toFixed(0)}: level ${lvl}, about ${Math.round(perHour / 1000)}k XP an hour per melee skill`);
  }
  p('  after dragon gear, on lesser demons: ' + marks.join('; '));
  p('  so: real hour 3 = about model hour 1.5 = Attack and Defence in the high 30s, adamant worn, rune next; real hour 10 = about model hour 5 = level 58 to 60, rune worn, dragon next; real hour 30 = about model hour 15 = the level printed above.');
}

p();
p(failures === 0 ? 'ALL CHECKS PASS' : `${failures} CHECK(S) FAILED`);
console.log(out.join('\n'));
if (failures) process.exitCode = 1;
