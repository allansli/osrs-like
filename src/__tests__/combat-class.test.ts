import { describe, expect, it } from 'vitest';
import { ITEMS, combatClassLabel, itemCombatClass, type CombatClass, type ItemDef } from '../data/items';
import {
  buildAmuletVisual,
  buildBodyVisual,
  buildBootVisual,
  buildCapeVisual,
  buildGloveVisual,
  buildHeadVisual,
  buildLegsVisual,
  buildRingVisual,
  buildShieldVisual,
  buildWeaponVisual,
  gearSilhouette,
  headShowsHair,
  type GearSilhouette
} from '../engine/playerGear';

const CLASSES: CombatClass[] = ['melee', 'ranged', 'magic', 'all_around', 'supply'];

const EXPECTED: Record<string, CombatClass> = {
  bronze_scimitar: 'melee',
  steel_longsword: 'melee',
  dharok_greataxe: 'melee',
  inquisitor_mace: 'melee',
  bandos_godsword: 'melee',
  abyssal_whip: 'melee',
  bronze_plate: 'melee',
  rune_legs: 'melee',
  dragon_chain: 'melee',
  bandos_chest: 'melee',
  bandos_tassets: 'melee',
  justiciar_body: 'melee',
  justiciar_legs: 'melee',
  inquisitor_legs: 'melee',
  torva_helm: 'melee',
  torva_body: 'melee',
  torva_legs: 'melee',
  deity_trousers: 'melee',
  neitiznot_helm: 'melee',
  dharok_helm: 'melee',
  dragon_helm: 'melee',
  hylian_shield: 'melee',
  wooden_shield: 'melee',
  dragon_defender: 'melee',
  primordial_boots: 'melee',
  ferocious_gloves: 'melee',
  fire_cape: 'melee',
  amulet_torture: 'melee',
  warrior_ring: 'melee',
  berserker_ring: 'melee',
  ultor_ring: 'melee',
  gilded_shield: 'melee',
  shortbow: 'ranged',
  willow_bow: 'ranged',
  maple_bow: 'ranged',
  yew_bow: 'ranged',
  magic_bow: 'ranged',
  ancient_bow: 'ranged',
  rune_crossbow: 'ranged',
  armadyl_crossbow: 'ranged',
  green_dhide_body: 'ranged',
  blue_dhide_chaps: 'ranged',
  red_dhide_body: 'ranged',
  black_dhide_body: 'ranged',
  black_dhide_chaps: 'ranged',
  sheikah_top: 'ranged',
  sheikah_bottom: 'ranged',
  sheikah_mask: 'ranged',
  armadyl_helm: 'ranged',
  armadyl_body: 'ranged',
  masori_body: 'ranged',
  masori_chaps: 'ranged',
  robin_hat: 'ranged',
  ranger_boots: 'ranged',
  pegasian_boots: 'ranged',
  leather_gloves: 'ranged',
  ava_accumulator: 'ranged',
  necklace_anguish: 'ranged',
  archers_ring: 'ranged',
  bronze_arrow: 'ranged',
  bronze_bolts: 'ranged',
  arrow_shaft: 'ranged',
  feather: 'ranged',
  fire_staff: 'magic',
  mystic_staff: 'magic',
  ancient_staff: 'magic',
  ahrim_staff: 'magic',
  kodai_wand: 'magic',
  wizard_hat: 'magic',
  wizard_top: 'magic',
  wizard_bottom: 'magic',
  mystic_hat: 'magic',
  mystic_top: 'magic',
  mystic_bottom: 'magic',
  infinity_top: 'magic',
  infinity_bottom: 'magic',
  ahrim_hood: 'magic',
  ahrim_top: 'magic',
  ahrim_bottom: 'magic',
  ancestral_hat: 'magic',
  ancestral_top: 'magic',
  ancestral_bottom: 'magic',
  eternal_boots: 'magic',
  god_cape: 'magic',
  occult_necklace: 'magic',
  seers_ring: 'magic',
  air_rune: 'magic',
  blood_rune: 'magic',
  law_rune: 'magic',
  champion_tunic: 'all_around',
  champion_leggings: 'all_around',
  champion_circlet: 'all_around',
  zora_armor: 'all_around',
  zora_greaves: 'all_around',
  barrows_gloves: 'all_around',
  infernal_cape: 'all_around',
  elysian_shield: 'all_around',
  amulet_accuracy: 'all_around',
  amulet_power: 'all_around',
  amulet_glory: 'all_around',
  amulet_fury: 'all_around',
  hylian_tunic: 'all_around',
  hylian_trousers: 'all_around',
  hylian_hood: 'all_around',
  hylian_cape: 'all_around',
  obsidian_cape: 'all_around',
  leather_boots: 'all_around',
  cooked_chicken: 'all_around',
  shrimp: 'all_around',
  prayer_potion: 'all_around',
  super_restore: 'all_around',
  logs: 'supply',
  magic_logs: 'supply',
  bronze_bar: 'supply',
  bones: 'supply',
  dragon_bones: 'supply',
  raw_shrimp: 'supply'
};

const SILHOUETTES: Record<string, GearSilhouette> = {
  wizard_hat: 'wizard-hat',
  mystic_hat: 'wizard-hat',
  ancestral_hat: 'wizard-hat',
  robin_hat: 'robin-hat',
  hylian_hood: 'hood',
  ahrim_hood: 'hood',
  sheikah_mask: 'sheikah-mask',
  champion_circlet: 'circlet',
  neitiznot_helm: 'neitiznot-helm',
  dharok_helm: 'horned-helm',
  torva_helm: 'horned-helm',
  dragon_helm: 'horned-helm',
  armadyl_helm: 'armadyl-helm',
  bronze_helm: 'helm',
  justiciar_helm: 'helm',
  bandos_chest: 'bandos-chest',
  torva_body: 'trim-plate',
  justiciar_body: 'trim-plate',
  dragon_chain: 'trim-plate',
  rune_plate: 'plate-body',
  green_dhide_body: 'dhide-body',
  armadyl_body: 'dhide-body',
  masori_body: 'dhide-body',
  wizard_top: 'robe-top',
  ancestral_top: 'robe-top',
  hylian_tunic: 'tunic',
  champion_tunic: 'tunic',
  sheikah_top: 'tunic',
  wizard_bottom: 'robe-skirt',
  ancestral_bottom: 'robe-skirt',
  bandos_tassets: 'tassets',
  justiciar_legs: 'tassets',
  inquisitor_legs: 'tassets',
  torva_legs: 'tassets',
  deity_trousers: 'tassets',
  green_dhide_chaps: 'dhide-chaps',
  masori_chaps: 'dhide-chaps',
  hylian_trousers: 'trousers',
  champion_leggings: 'trousers',
  bronze_legs: 'platelegs',
  rune_crossbow: 'crossbow',
  armadyl_crossbow: 'crossbow',
  shortbow: 'bow',
  magic_bow: 'bow',
  ancient_bow: 'ancient-bow',
  dharok_greataxe: 'greataxe',
  inquisitor_mace: 'mace',
  kodai_wand: 'wand',
  fire_staff: 'staff',
  mystic_staff: 'staff',
  ancient_staff: 'ancient-staff',
  ahrim_staff: 'ahrim-staff',
  abyssal_whip: 'whip',
  bronze_scimitar: 'scimitar',
  steel_longsword: 'sword',
  bandos_godsword: 'greatsword',
  master_sword: 'greatsword',
  dragon_defender: 'defender',
  elysian_shield: 'elysian',
  hylian_shield: 'hylian-shield',
  wooden_shield: 'kiteshield',
  gilded_shield: 'kiteshield',
  amulet_fury: 'amulet',
  occult_necklace: 'amulet',
  berserker_ring: 'ring',
  pegasian_boots: 'pegasian-boots',
  primordial_boots: 'primordial-boots',
  eternal_boots: 'eternal-boots',
  leather_boots: 'boots',
  ferocious_gloves: 'gloves',
  ava_accumulator: 'ava',
  fire_cape: 'lava-cape',
  infernal_cape: 'lava-cape',
  hylian_cape: 'cape',
  obsidian_cape: 'cape',
  god_cape: 'cape'
};

function visualFor(item: ItemDef) {
  switch (item.slot) {
    case 'weapon':
      return buildWeaponVisual(item).group;
    case 'head':
      return buildHeadVisual(item);
    case 'body':
      return buildBodyVisual(item).torso;
    case 'legs':
      return buildLegsVisual(item).torso ?? buildLegsVisual(item).left;
    case 'shield':
      return buildShieldVisual(item);
    case 'neck':
      return buildAmuletVisual(item);
    case 'ring':
      return buildRingVisual(item);
    case 'feet':
      return buildBootVisual(item, true);
    case 'hands':
      return buildGloveVisual(item);
    case 'cape':
      return buildCapeVisual(item);
    default:
      return null;
  }
}

describe('itemCombatClass', () => {
  it('puts every catalog item into exactly one combat class', () => {
    const counts: Record<CombatClass, number> = {
      melee: 0,
      ranged: 0,
      magic: 0,
      all_around: 0,
      supply: 0
    };
    for (const item of Object.values(ITEMS)) {
      const kind = itemCombatClass(item);
      expect(CLASSES).toContain(kind);
      expect(combatClassLabel(kind).length).toBeGreaterThan(0);
      counts[kind] += 1;
      if (item.type === 'equip') expect(kind).not.toBe('supply');
      if (item.type === 'rune') expect(kind).toBe('magic');
      if (item.type === 'ammo') expect(kind).toBe('ranged');
      if (item.type === 'food' || item.type === 'potion') expect(kind).toBe('all_around');
      if (item.type === 'resource' || item.type === 'bones' || item.type === 'bar') expect(kind).toBe('supply');
    }
    expect(itemCombatClass(null)).toBe('supply');
    expect(combatClassLabel('all_around')).toBe('All-Around');
    for (const kind of CLASSES) expect(counts[kind]).toBeGreaterThan(0);
  });

  it('matches the shop combat-style lists, including hybrid and style conflicts', () => {
    for (const [id, kind] of Object.entries(EXPECTED)) {
      expect(ITEMS[id], id).toBeTruthy();
      expect(itemCombatClass(ITEMS[id]), id).toBe(kind);
    }
  });
});

describe('gear silhouettes', () => {
  it('gives every named loadout piece its own 3D silhouette', () => {
    for (const [id, silhouette] of Object.entries(SILHOUETTES)) {
      const item = ITEMS[id];
      expect(item, id).toBeTruthy();
      expect(gearSilhouette(item), id).toBe(silhouette);
      const visual = visualFor(item);
      expect(visual, id).toBeTruthy();
      expect(visual?.userData.silhouette, id).toBe(silhouette);
      expect(visual?.children.length, id).toBeGreaterThan(0);
    }
  });

  it('keeps hair visible only for a circlet', () => {
    expect(headShowsHair(null)).toBe(true);
    expect(headShowsHair(ITEMS.champion_circlet)).toBe(true);
    expect(headShowsHair(ITEMS.wizard_hat)).toBe(false);
    expect(headShowsHair(ITEMS.robin_hat)).toBe(false);
    expect(headShowsHair(ITEMS.bronze_helm)).toBe(false);
    expect(headShowsHair(ITEMS.hylian_hood)).toBe(false);
  });

  it('keeps the abyssal whip rig animatable', () => {
    const visual = buildWeaponVisual(ITEMS.abyssal_whip);
    expect(visual.whipRig?.rest.length).toBe(5);
    expect(visual.whipRig?.nodes.length).toBe(5);
    expect(visual.whipRig?.tube).toBeTruthy();
  });

  it('splits robe cuffs and platelegs onto the limbs', () => {
    const robe = buildBodyVisual(ITEMS.ancestral_top);
    expect(robe.left?.children.length).toBeGreaterThan(0);
    expect(robe.right?.children.length).toBeGreaterThan(0);
    const skirt = buildLegsVisual(ITEMS.ancestral_bottom);
    expect(skirt.torso?.children.length).toBeGreaterThan(0);
    expect(skirt.left).toBeNull();
    const plate = buildLegsVisual(ITEMS.rune_legs);
    expect(plate.torso).toBeNull();
    expect(plate.left?.children.length).toBeGreaterThan(0);
    expect(plate.right?.children.length).toBeGreaterThan(0);
  });
});
