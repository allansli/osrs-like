// D4 (models pass): every monster row's model, body and kit resolve to nodes of the monsters contract (design 6.1, 6.2).
// The contract read is the pending manifest when one exists (the built file's), else the live one (rule 0.3.5), so this stays
// independent of scratch builds. Red for the body until D5 (Ashmantle's row names it) and for the two kits until K3.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MONSTER_TYPES } from '../src/data/world';

const CONTRACT = path.resolve(__dirname, 'fixtures/model-contract');
type Manifest = {
  nodes: Record<string, { parent: string | null }>;
  skin: { bones: Record<string, unknown>; limbs: { bone: string; child: string }[]; skinnedRoots: string[] };
};
const pending = path.join(CONTRACT, 'pending', 'monsters.json');
const manifest = JSON.parse(fs.readFileSync(fs.existsSync(pending) ? pending : path.join(CONTRACT, 'monsters.json'), 'utf8')) as Manifest;

const rows = Object.entries(MONSTER_TYPES);
const modelOf = (key: string): string => MONSTER_TYPES[key].model ?? key;

/** The unprefixed bone or pivot names a figure has: its skin bones and limb ends, plus its rigid `<key>_X` nodes. */
function bonesOf(key: string): Set<string> {
  const prefix = `${key}_`;
  const names = [
    ...Object.keys(manifest.skin.bones),
    ...manifest.skin.limbs.flatMap((l) => [l.bone, l.child]),
    ...Object.keys(manifest.nodes)
  ];
  return new Set(names.filter((n) => n.startsWith(prefix)).map((n) => n.slice(prefix.length)));
}

describe('every row has its figure', () => {
  it.each(rows)('%s: a Monster_ node with both leg bones or pivots', (typeKey) => {
    const key = modelOf(typeKey);
    expect(manifest.nodes[`Monster_${key}`], `Monster_${key}`).toBeDefined();
    const bones = bonesOf(key);
    expect(bones.has('LeftLegPivot'), `${key} left leg`).toBe(true);
    expect(bones.has('RightLegPivot'), `${key} right leg`).toBe(true);
  });
});

describe('bodies', () => {
  const withBody = rows.filter(([, d]) => d.body);

  it.each(withBody)('%s: its body is a Monster_ node on the same skeleton as its model', (typeKey, def) => {
    expect(manifest.nodes[`Monster_${def.body}`], `Monster_${def.body}`).toBeDefined();
    const own = bonesOf(def.body!);
    expect(own.size, `bones of ${def.body}`).toBeGreaterThan(0);
    expect([...own].sort()).toEqual([...bonesOf(modelOf(typeKey))].sort());
  });

  it("Ashmantle's row names its own body, and nothing else changes in it", () => {
    expect(MONSTER_TYPES.ashmantle.body).toBe('ashmantle');
    expect(MONSTER_TYPES.ashmantle.model).toBe('elvarg_dragon');
  });
});

describe('kits', () => {
  const withKit = rows.filter(([, d]) => d.kit);

  it.each(withKit)('%s: its kit is a Kit_ node whose children name bones of its model', (typeKey, def) => {
    expect(manifest.nodes[`Kit_${def.kit}`], `Kit_${def.kit}`).toBeDefined();
    const key = modelOf(typeKey);
    const bones = bonesOf(key);
    const children = Object.entries(manifest.nodes).filter(([, n]) => n.parent === `Kit_${def.kit}`).map(([name]) => name);
    expect(children.length, `children of Kit_${def.kit}`).toBeGreaterThan(0);
    for (const child of children) {
      // Plan O-6.1b.6 amendment (declared): every kit child is named <kit>_<Bone>, and <Bone> is a bone of the model
      expect(child.startsWith(`${def.kit}_`), `${child} carries the ${def.kit}_ prefix`).toBe(true);
      const bone = child.slice(`${def.kit}_`.length);
      expect(bones.has(bone), `${child}: ${bone} names a bone of ${key}`).toBe(true);
    }
  });

  it('the two variant rows name their kits', () => {
    expect(MONSTER_TYPES.saltback_stalker.kit).toBe('saltback_stalker');
    expect(MONSTER_TYPES.thornwatch_marksman.kit).toBe('thornwatch_marksman');
  });
});

describe('stats and model keys', () => {
  it('no row differs from the snapshot taken here', () => {
    const now = Object.fromEntries(
      rows.map(([k, d]) => [k, { name: d.name, level: d.level, hp: d.hp, maxHit: d.maxHit, atk: d.atk, def: d.def, drops: d.drops, model: d.model ?? null }])
    );
    expect(now).toEqual(SNAPSHOT);
  });
});

const SNAPSHOT = {
  chicken: {"name":"Plump Chicken","level":1,"hp":4,"maxHit":1,"atk":1,"def":1,"drops":[{"id":"bones","chance":1},{"id":"cooked_chicken","chance":0.6},{"gp":[6,18],"chance":0.85},{"id":"feather","chance":0.8,"qty":5}],"model":null},
  goblin: {"name":"Goblin Raider","level":2,"hp":8,"maxHit":2,"atk":3,"def":2,"drops":[{"id":"bones","chance":1},{"gp":[12,36],"chance":0.9},{"id":"iron_plate","chance":0.008},{"id":"iron_legs","chance":0.008},{"id":"shrimp","chance":0.35}],"model":null},
  scorpion: {"name":"King Scorpion","level":12,"hp":22,"maxHit":5,"atk":12,"def":10,"drops":[{"id":"bones","chance":1},{"gp":[40,95],"chance":0.95},{"id":"steel_plate","chance":0.011},{"id":"steel_legs","chance":0.011},{"id":"trout","chance":0.4},{"id":"sting_gland","chance":0.1}],"model":null},
  dark_wizard: {"name":"Dark Wizard","level":18,"hp":30,"maxHit":7,"atk":18,"def":14,"drops":[{"id":"bones","chance":1},{"gp":[65,160],"chance":0.95},{"id":"mystic_top","chance":0.01},{"id":"mystic_bottom","chance":0.01},{"id":"mith_scimitar","chance":0.009}],"model":null},
  hill_giant: {"name":"Hill Giant","level":28,"hp":48,"maxHit":10,"atk":26,"def":22,"drops":[{"id":"big_bones","chance":1},{"gp":[110,260],"chance":0.95},{"id":"addy_plate","chance":0.011},{"id":"addy_legs","chance":0.011},{"id":"lobster","chance":0.45}],"model":null},
  moss_guardian: {"name":"Moss Guardian","level":45,"hp":78,"maxHit":15,"atk":42,"def":38,"drops":[{"id":"big_bones","chance":1},{"gp":[200,500],"chance":1},{"id":"rune_plate","chance":0.011},{"id":"rune_legs","chance":0.011},{"id":"green_dhide_body","chance":0.012},{"id":"green_dhide_chaps","chance":0.012},{"id":"mire_root","chance":0.15}],"model":null},
  lesser_demon: {"name":"Lesser Demon","level":68,"hp":125,"maxHit":22,"atk":64,"def":55,"drops":[{"id":"dragon_bones","chance":1},{"gp":[450,980],"chance":1},{"id":"dragon_chain","chance":0.01},{"id":"dragon_legs","chance":0.01},{"id":"dragon_scimitar","chance":0.009},{"id":"shark","chance":0.65}],"model":null},
  elvarg_dragon: {"name":"Elvarg the Crag Dragon","level":95,"hp":260,"maxHit":32,"atk":88,"def":78,"drops":[{"id":"dragon_bones","chance":1},{"gp":[1800,3800],"chance":1},{"id":"bandos_chest","chance":0.05},{"id":"bandos_tassets","chance":0.05},{"id":"champion_tunic","chance":0.05},{"id":"champion_leggings","chance":0.05}],"model":null},
  goblin_archer: {"name":"Goblin Archer","level":5,"hp":12,"maxHit":3,"atk":8,"def":3,"drops":[{"id":"bones","chance":1},{"gp":[8,24],"chance":0.8},{"id":"bronze_arrow","chance":0.7},{"id":"shortbow","chance":0.004}],"model":null},
  dark_ranger: {"name":"Dark Ranger","level":24,"hp":36,"maxHit":9,"atk":28,"def":14,"drops":[{"id":"bones","chance":1},{"gp":[40,120],"chance":0.95},{"id":"bronze_arrow","chance":1},{"id":"willow_bow","chance":0.008},{"id":"green_dhide_body","chance":0.004}],"model":null},
  saltback_stalker: {"name":"Saltback Stalker","level":34,"hp":58,"maxHit":12,"atk":32,"def":28,"drops":[{"id":"big_bones","chance":1},{"gp":[140,340],"chance":0.95},{"id":"lobster","chance":0.4},{"id":"sting_gland","chance":0.15}],"model":"scorpion"},
  thornwatch_marksman: {"name":"Thornwatch Marksman","level":38,"hp":54,"maxHit":13,"atk":36,"def":26,"drops":[{"id":"big_bones","chance":1},{"gp":[160,400],"chance":0.95},{"id":"bronze_arrow","chance":1},{"id":"swordfish","chance":0.3}],"model":"dark_ranger"},
  ashmantle: {"name":"Ashmantle the Slag Wyrm","level":110,"hp":1400,"maxHit":72,"atk":120,"def":78,"drops":[{"gp":[1500,3000],"chance":1},{"id":"dragon_bones","chance":1},{"id":"shark","chance":1}],"model":"elvarg_dragon"},
  // Stage 6 slice 1 (D3, declared 11.3 item 17). Cinder Silk, Slagscale Hide and Tough Hide arrive with K2, which edits these rows then.
  cinder_adept: {"name":"Cinder Adept","level":52,"hp":80,"maxHit":17,"atk":49,"def":36,"drops":[{"id":"big_bones","chance":1},{"gp":[230,550],"chance":1},{"id":"ashes","chance":0.5,"qty":2}],"model":"dark_wizard"},
  slag_brute: {"name":"Slag Brute","level":58,"hp":112,"maxHit":19,"atk":54,"def":48,"drops":[{"id":"big_bones","chance":1},{"gp":[340,770],"chance":1},{"id":"shark","chance":0.4}],"model":"hill_giant"},
  marrowjaw: {"name":"Marrowjaw the Tollmaster","level":40,"hp":560,"maxHit":21,"atk":52,"def":30,"drops":[{"id":"big_bones","chance":1},{"gp":[600,1200],"chance":1},{"id":"lobster","chance":1,"qty":2},{"id":"runite_bar","chance":0.125}],"model":"hill_giant"},
  // Stage 6 slice 3 (Z3, declared 11.3 item 17). Chitin Plate and the like arrive with K2, which edits these rows then.
  scree_skitter: {"name":"Scree Skitter","level":30,"hp":20,"maxHit":6,"atk":30,"def":14,"drops":[{"id":"bones","chance":1},{"gp":[20,60],"chance":0.6}],"model":"scorpion"},
  saltfang: {"name":"Matron Saltfang","level":48,"hp":960,"maxHit":36,"atk":66,"def":42,"drops":[{"id":"big_bones","chance":1},{"gp":[300,600],"chance":1},{"id":"sting_gland","chance":1,"qty":3},{"id":"adamant_bar","chance":0.2,"qty":3}],"model":"scorpion"},
  // Stage 6 slice 3a (C1, declared 11.3 item 17). Slagscale Hide arrives with K2, which edits this row then.
  ember_hurler: {"name":"Ember Hurler","level":66,"hp":105,"maxHit":19,"atk":64,"def":44,"drops":[{"id":"dragon_bones","chance":1},{"gp":[340,760],"chance":1},{"id":"shark","chance":0.5},{"id":"ashes","chance":0.5,"qty":2}],"model":"lesser_demon"}
};
