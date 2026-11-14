// Second-pass check of the 2026-11-14 revision, against origin/main's real code (second-pass.sh extracts it to ./main).
// Independent of model.ts: it builds its own kits and reference monsters, and checks its transcription of the attack
// formula against main's playerAttackProfile before using it. Sections:
//   A. the style band at EVERY level 1 to 99, not only at the decades (design 7.12)
//   B. a strong hero fighting one member of a camp: how many others join (design 7.13, "chain-pull")
//   C. a combat-70 woodcutter at the seven yew and magic trees (design 7.13)
//   D. Kilnglass: one certain shard a clear against pure chance with the same mean (design 7.6, CALL-6.25)
import { ITEMS } from './main/src/data/items';
import { SPELLS } from './main/src/data/magic';
import { CAMPS } from './main/src/data/worldMap';
import { NODE_PLACEMENTS } from './main/src/data/placements';
import { createDefaultState } from './main/src/state/gameState';
import { isWalkable } from './main/src/state/collision';
import { getEquipmentBonuses, playerAttackProfile, playerHitChance } from './main/src/state/combat';
import { createMonsterLogic, onPlayerHit, stepMonster } from './main/src/state/monsterAi.patched';

let failures = 0;
const check = (ok: boolean, what: string) => { if (!ok) { failures++; console.log(`  CHECK FAILED: ${what}`); } };
function seeded(seed: number) { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2);

// ---------------------------------------------------------------- A. the band at every level
type Style = 'melee' | 'ranged' | 'magic';
const SPECIAL_TIERS = ['raids', 'botw', 'barrows', 'bandos', 'gilded'];
const SPECIAL_IDS = ['abyssal_whip', 'toxic_blowpipe', 'trident_seas', 'granite_body', 'granite_legs'];
const SELF_DRAWN = ['ancient_bow', 'crystal_bow', 'toxic_blowpipe'];
const I = ITEMS as Record<string, any>;
const combatSpells = SPELLS.filter((s) => s.type === 'combat').sort((a, b) => (a.maxHit || 0) - (b.maxHit || 0));
const bestSpell = (lvl: number) => combatSpells.filter((s) => s.req <= lvl).pop()!;
// The arrow of the level (design 7.4): iron from 25 (arrows only), mithril from 45, rune from 70.
const ammoPower = (lvl: number, crossbow: boolean) => lvl >= 70 ? 6 : lvl >= 45 ? 4 : (lvl >= 25 && !crossbow) ? 2 : 0;
function build(style: Style, lvl: number, special: boolean, allSlots: boolean) {
  const s = createDefaultState() as any;
  for (const k of Object.keys(s.equipment)) s.equipment[k] = null;
  for (const k of Object.keys(s.skills)) if (k !== 'hitpoints' && k !== 'prayer') s.skills[k].lvl = lvl;
  const ok = (it: any) => Object.values(it.req || {}).every((v: any) => v <= lvl) && (special || (!SPECIAL_TIERS.includes(it.tier) && !SPECIAL_IDS.includes(it.id)));
  const key = (it: any) => style === 'melee' ? (it.atk || 0) + (it.str || 0) : style === 'ranged' ? (it.rng || 0) : (it.mag || 0);
  const slots = allSlots ? [...new Set(Object.values(I).filter((i: any) => i.type === 'equip').map((i: any) => i.slot))] : ['weapon', 'body', 'legs'];
  for (const slot of slots) {
    let pool = Object.values(I).filter((i: any) => i.type === 'equip' && i.slot === slot && ok(i));
    if (slot === 'weapon') pool = pool.filter((i: any) => i.style === style);
    else if (style === 'melee') pool = pool.filter((i: any) => !i.rng && !i.mag);
    else pool = pool.filter((i: any) => key(i) > 0);
    const sortKey = (i: any) => slot === 'weapon' ? key(i) : style === 'melee' ? (allSlots ? (i.str || 0) * 3 + (i.def || 0) : (i.def || 0)) : key(i);
    pool.sort((a: any, b: any) => sortKey(b) - sortKey(a));
    if (pool[0]) s.equipment[slot] = (pool[0] as any).id;
  }
  s.combatStyle = style === 'melee' ? 'controlled' : style === 'ranged' ? 'rapid' : 'magic';
  if (style === 'magic') s.activeSpell = bestSpell(lvl).id;
  return s;
}
const TODAY = { rb: 2, rg: 0.22, mm: 1 }, AFTER = { rb: 3, rg: 0.06, mm: 0.5 };
function maxHit(style: Style, s: any, c: typeof AFTER, ammo: number) {
  const b = getEquipmentBonuses(s);
  if (style === 'ranged') return Math.max(2, Math.floor(c.rb + s.skills.ranged.lvl * 0.35 + b.rng * c.rg + ammo));
  if (style === 'magic') { const sp = SPELLS.find((x) => x.id === s.activeSpell)!; return Math.max(3, Math.floor((sp.maxHit! + s.skills.magic.lvl * 0.22 + b.mag * 0.18) * c.mm)); }
  return playerAttackProfile(s).maxHit;
}
for (const st of ['ranged', 'magic'] as Style[]) for (const l of [1, 20, 45, 70, 99]) {
  const s = build(st, l, false, false);
  check(maxHit(st, s, TODAY, 0) === playerAttackProfile(s).maxHit, `transcription of today's ${st} formula at ${l}`);
}
const mean = (m: number) => (1 + (m * (m + 1)) / 2) / (m + 1);
// Reference monsters by defence; the stalker (28) and the brute (48) are Stage 4 and Stage 6 rows, the rest main's.
const REF: [number, string, number][] = [[15, 'scorpion', 10], [25, 'dark_wizard', 14], [35, 'hill_giant', 22], [45, 'saltback_stalker', 28], [55, 'moss_guardian', 38], [65, 'slag_brute', 48], [80, 'lesser_demon', 55], [100, 'elvarg_dragon', 78]];
const refFor = (lvl: number) => REF.find(([u]) => lvl < u)!;
function row(lvl: number, special: boolean, allSlots: boolean, withArrow: boolean) {
  const [, ref, def] = refFor(lvl);
  const d: Record<string, number> = {};
  const kit: string[] = [];
  for (const st of ['melee', 'ranged', 'magic'] as Style[]) {
    const s = build(st, lvl, special, allSlots);
    const hc = playerHitChance(playerAttackProfile(s).accuracy, def);
    const w = s.equipment.weapon as string;
    const ammo = st === 'ranged' && withArrow && !SELF_DRAWN.includes(w) ? ammoPower(lvl, I[w]?.iconKind === 'crossbow') : 0;
    d[st + '0'] = hc * mean(maxHit(st, s, TODAY, 0)); d[st + '1'] = hc * mean(maxHit(st, s, AFTER, ammo));
    kit.push(w + (st === 'magic' ? ` ${s.activeSpell}` : ''));
  }
  const r = d.ranged1 / d.melee0, g = d.magic1 / d.melee0;
  return { ref, r, g, r0: d.ranged0 / d.melee0, g0: d.magic0 / d.melee0, spread: Math.max(1, r, g) / Math.min(1, r, g), kit: kit.join(' / ') };
}
console.log('\nA. The style band at every level (times melee\'s damage per second; "spread" is the fastest over the slowest)');
for (const [label, special, all, arrow] of [
  ['standard kit (best ordinary weapon, body, legs), arrow of the level', false, false, true],
  ['standard kit, bronze arrows (what S1 asserts before arrow grades exist)', false, false, false],
  ['every slot filled with ordinary gear, arrow of the level', false, true, true],
  ['special sets and uniques allowed, weapon body legs, arrow of the level', true, false, true]] as const) {
  console.log(`  -- ${label}`);
  let w = { s: 0, l: 0 }, w2 = { s: 0, l: 0 }, rmin = 9, rmax = 0, gmin = 9, gmax = 0;
  const over: number[] = [];
  for (let l = 1; l <= 99; l++) {
    const x = row(l, special, all, arrow);
    if (l >= 20 && l <= 70) { if (x.spread > w.s) w = { s: x.spread, l }; rmin = Math.min(rmin, x.r); rmax = Math.max(rmax, x.r); gmin = Math.min(gmin, x.g); gmax = Math.max(gmax, x.g); if (x.spread > 1.4) over.push(l); }
    if (l > 70 && x.spread > w2.s) w2 = { s: x.spread, l };
    if ([20, 28, 29, 30, 40, 49, 50, 60, 70, 80, 90, 99].includes(l)) console.log(`    ${String(l).padStart(2)} ${x.ref.padEnd(16)} ranged x${f2(x.r0)} -> x${f2(x.r)}  magic x${f2(x.g0)} -> x${f2(x.g)}  spread ${f2(x.spread)}   ${x.kit}`);
  }
  console.log(`    every level 20 to 70: ranged x${f2(rmin)} to x${f2(rmax)}, magic x${f2(gmin)} to x${f2(gmax)}; largest spread ${f2(w.s)} at level ${w.l}; levels above 1.4: ${over.length ? over.join(', ') : 'none'}`);
  console.log(`    every level 71 to 99: largest spread ${f2(w2.s)} at level ${w2.l}`);
  if (!special && !all) {
    const dec = [20, 30, 40, 50, 60, 70].map((l) => row(l, false, false, arrow));
    check(dec.every((x) => x.r >= 0.9 && x.r <= 1.35 && x.g >= 0.95 && x.g <= 1.4 && x.spread <= 1.4), `${label}: the decade levels hold design 7.12's band`);
    check(w.s <= 1.45, `${label}: every level 20 to 70 within 1.45 (the plan's S1 bound between decades)`);
  }
}

// ---------------------------------------------------------------- B. chain-pull
console.log('\nB. A hero 10 or 30 combat levels above an aggressive camp fights one member for 60 s, standing still (patched rule).');
console.log('   Other members that join, per fight (mean, most), 200 seeds per member; the hero stands toward the camp centre.');
for (const gap of [10, 30]) for (const stand of [2, 7]) {
  const parts: string[] = [];
  for (const c of CAMPS.filter((x) => x.aggressive && x.id !== 'pass_sentries' && x.members.length > 1)) {
    let total = 0, most = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const rand = seeded(seed);
      for (let ti = 0; ti < c.members.length; ti++) {
        const ms = c.members.map((mem) => { const m = createMonsterLogic(mem.type, mem.x, mem.z, { campId: c.id, wander: mem.wander }); m.wanderTimer = rand() * 3; return m; });
        const t = ms[ti], dx = c.x - t.homeX, dz = c.z - t.homeZ, d = Math.hypot(dx, dz) || 1, k = Math.min(stand, d);
        const px = t.homeX + (dx / d) * k, pz = t.homeZ + (dz / d) * k;
        onPlayerHit(t, 0);
        const joined = new Set<number>();
        for (let step = 0; step < 1200; step++) {
          const w = { playerX: px, playerZ: pz, playerDown: false, dt: 0.05, rand, playerCombat: t.level + gap, playerSafe: false, camps: CAMPS };
          ms.forEach((m, i) => { for (const e of stepMonster(m, w)) if (e.kind === 'aggro' && i !== ti) joined.add(i); });
        }
        total += joined.size; most = Math.max(most, joined.size);
      }
    }
    parts.push(`${c.id} (${c.members.length}) ${(total / (200 * c.members.length)).toFixed(2)}/${most}`);
  }
  console.log(`  +${gap} levels, ${stand} from the target: ${parts.join('; ')}`);
}

// ---------------------------------------------------------------- C. the high trees
console.log('\nC. A combat-70 hero gathers at each yew and magic tree (8 directions x 50 seeds, 5 minutes a run). The engine walks a');
console.log('   gatherer to within 3.1 of the node (loop.ts stopDist), so it stands about 3.0 from the tree; 1.5 is shown as well.');
console.log('   Today (Stage 2) no guardian attacks it. On main nothing ends a gather when the hero is hit (only death or depletion');
console.log('   clear the target, loop.ts and actions.ts), and Stage 4\'s auto-retaliation leaves a gatherer alone, so this is how soon');
console.log('   a hero away from the keys starts losing health. "wander 0": the guardians never leave home (the first lever, tried).');
const woods = CAMPS.filter((c) => c.id.startsWith('deep_woods'));
for (const [label, standOff, wander0] of [['stands 3.0 from the tree, wander as today', 3.0, false], ['stands 1.5 from the tree, wander as today', 1.5, false], ['stands 3.0 from the tree, wander 0', 3.0, true], ['stands 1.5 from the tree, wander 0', 1.5, true]] as const) {
  console.log(`  -- ${label}`);
  for (const n of (NODE_PLACEMENTS as any[]).filter((n) => n.type === 'yew_tree' || n.type === 'magic_tree')) {
    const times: number[] = []; let never = 0, spotsAttacked = 0, spots = 0;
    const nearest = Math.min(...woods.flatMap((c) => c.members.map((m) => Math.hypot(m.x - n.x, m.z - n.z))));
    for (let a = 0; a < 8; a++) {
      const px = n.x + Math.cos(a * Math.PI / 4) * standOff, pz = n.z + Math.sin(a * Math.PI / 4) * standOff;
      if (!isWalkable(px, pz)) continue;
      spots++; let here = 0;
      for (let seed = 1; seed <= 50; seed++) {
        const rand = seeded(seed * 8 + a);
        const ms = woods.flatMap((c) => c.members.map((mem) => { const m = createMonsterLogic(mem.type, mem.x, mem.z, { campId: c.id, wander: wander0 ? 0 : mem.wander }); m.wanderTimer = rand() * 3; return m; }));
        let hit = -1;
        for (let step = 0; step < 6000 && hit < 0; step++) {
          const w = { playerX: px, playerZ: pz, playerDown: false, dt: 0.05, rand, playerCombat: 70, playerSafe: false, camps: CAMPS };
          for (const m of ms) if (stepMonster(m, w).some((e) => e.kind === 'aggro')) hit = step * 0.05;
        }
        if (hit < 0) never++; else { times.push(hit); here++; }
      }
      if (here > 0) spotsAttacked++;
    }
    times.sort((x, y) => x - y);
    console.log(`    ${n.type.padEnd(10)} (${n.x}, ${n.z}): nearest guardian home ${nearest.toFixed(1)}; attacked in ${times.length} of ${times.length + never} runs (${spotsAttacked} of ${spots} spots), median ${times.length ? times[Math.floor(times.length / 2)].toFixed(0) + ' s' : '-'}`);
  }
}

// ---------------------------------------------------------------- D. Kilnglass
console.log('\nD. Kilnglass a clear (chest and Kiln Warden; a Wyrmsteel Ingot counts as one): clears needed, exact distribution');
function dist(entries: [number, number][]) { let d = new Map<number, number>([[0, 1]]); for (const [q, p] of entries) { const n = new Map<number, number>(); for (const [s, ps] of d) { n.set(s + q, (n.get(s + q) || 0) + ps * p); n.set(s, (n.get(s) || 0) + ps * (1 - p)); } d = n; } return d; }
function clears(d: Map<number, number>, need: number) {
  let cur = new Map<number, number>([[0, 1]]), prev = 0, e = 0; const res: [number, number][] = [];
  for (let n = 1; n < 400; n++) { const nx = new Map<number, number>(); for (const [s, p] of cur) for (const [k, q] of d) { const t = Math.min(need, s + k); nx.set(t, (nx.get(t) || 0) + p * q); } cur = nx; const done = cur.get(need) || 0; e += n * (done - prev); prev = done; res.push([n, done]); if (done > 1 - 1e-12) break; }
  const at = (x: number) => res.find(([, dd]) => dd >= x)![0];
  return `mean ${e.toFixed(2)}, half ${at(0.5)}, nine in ten ${at(0.9)}, 99 in 100 ${at(0.99)}, worst ${res[res.length - 1][1] > 1 - 1e-12 && res.length < 399 && d.get(0) === undefined ? res.length : 'no limit'}`;
}
const variants: [string, [number, number][]][] = [
  ['as proposed: 1 certain, 3 more at 20%, boss 1 at 50%, ingot 10%', [[1, 1], [3, 0.2], [1, 0.5], [1, 0.1]]],
  ['pure chance, same mean: 2 at 50%, 3 at 20%, boss 1 at 50%, ingot 10%', [[2, 0.5], [3, 0.2], [1, 0.5], [1, 0.1]]]];
for (const [label, e] of variants) {
  const d = dist(e); const m = [...d].reduce((t, [k, p]) => t + k * p, 0);
  if ((d.get(0) || 0) === 0) d.delete(0);
  console.log(`  ${label}: ${m.toFixed(2)} a clear, a clear with none ${(((d.get(0) || 0)) * 100).toFixed(0)}%`);
  console.log(`    one dragon scimitar (4): ${clears(d, 4)}; the whole kit (13): ${clears(d, 13)}`);
}

console.log(failures === 0 ? '\nSECOND-PASS CHECKS PASS' : `\n${failures} SECOND-PASS CHECK(S) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
