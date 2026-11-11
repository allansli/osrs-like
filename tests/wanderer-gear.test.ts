import { describe, expect, it } from 'vitest';
import { MONSTER_TYPES } from '../src/data/world';
import { PALETTE_BY_ID } from '../src/paint/palettes';
import { paletteIsUsable } from '../src/paint/body';
import { paintFlagsForMesh, speciesPaint, SPECIES_PAINT } from '../src/paint/species';
import { SCIMITAR_CURVE } from '../src/paint/oilGear';
import {
  GEAR_DAB_SIZE,
  boneForSlot,
  fitScale,
  gearJitter,
  paletteForGear,
  poseForSlot,
  strokeForGear,
  type GearSlot
} from '../src/paint/wandererGear';

const SLOTS: GearSlot[] = ['head', 'cape', 'neck', 'body', 'bodyArm', 'legs', 'legsSide', 'hands', 'feet', 'weapon', 'shield', 'ring'];

describe('wanderer slot bones', () => {
  it('maps every equipment slot onto a MakeHuman bone, both sides where the body has two', () => {
    expect(boneForSlot('head')).toBe('Head');
    expect(boneForSlot('cape')).toBe('spine_03');
    expect(boneForSlot('neck')).toBe('neck_01');
    expect(boneForSlot('body')).toBe('spine_02');
    expect(boneForSlot('legs')).toBe('pelvis');
    expect(boneForSlot('weapon')).toBe('hand_r');
    expect(boneForSlot('shield')).toBe('lowerarm_l');
    expect(boneForSlot('ring')).toBe('hand_r');
    expect(boneForSlot('hands', 'l')).toBe('hand_l');
    expect(boneForSlot('hands', 'r')).toBe('hand_r');
    expect(boneForSlot('feet', 'l')).toBe('foot_l');
    expect(boneForSlot('feet', 'r')).toBe('foot_r');
    expect(boneForSlot('bodyArm', 'l')).toBe('upperarm_l');
    expect(boneForSlot('bodyArm', 'r')).toBe('upperarm_r');
    expect(boneForSlot('legsSide', 'l')).toBe('thigh_l');
    expect(boneForSlot('legsSide', 'r')).toBe('thigh_r');
    for (const slot of SLOTS) {
      const pose = poseForSlot(slot, slot === 'weapon' ? 'scimitar' : '');
      expect(pose.position.every((n) => Number.isFinite(n))).toBe(true);
      expect(pose.rotation.every((n) => Number.isFinite(n))).toBe(true);
      expect(pose.scale).toBeGreaterThan(0);
      expect(fitScale(0.4, slot)).toBeGreaterThan(0);
    }
  });

  it('paints metal with jitter 0.25 and blades along the bone', () => {
    expect(paletteForGear({ id: 'bronze_scimitar', tier: 'bronze', slot: 'weapon', iconKind: 'scimitar' })).toBe('bronze');
    expect(paletteForGear({ id: 'rune_plate', tier: 'rune', slot: 'body' })).toBe('rune');
    expect(paletteForGear({ id: 'mith_helm', tier: 'mithril', slot: 'head' })).toBe('mithril');
    expect(paletteForGear({ id: 'addy_legs', tier: 'adamant', slot: 'legs' })).toBe('adamant');
    expect(paletteForGear({ id: 'steel_shield', tier: 'steel', slot: 'shield' })).toBe('steel');
    expect(paletteForGear({ id: 'iron_boots', tier: 'iron', slot: 'feet' })).toBe('iron');
    expect(paletteForGear({ id: 'dragon_gloves', tier: 'dragon', slot: 'hands' })).toBe('dragon_metal');
    expect(paletteForGear({ id: 'leather_boots', tier: 'bronze', slot: 'feet' })).toBe('leather');
    expect(paletteForGear({ id: 'green_dhide_body', tier: 'adamant', slot: 'body' })).toBe('dhide');
    expect(paletteForGear({ id: 'fire_cape', tier: 'dragon', slot: 'cape' })).toBe('cloth');
    expect(paletteForGear({ id: 'wooden_shield', tier: 'bronze', slot: 'shield' })).toBe('timber');
    expect(paletteForGear({ id: 'willow_bow', tier: 'iron', slot: 'weapon', iconKind: 'bow' })).toBe('timber');
    expect(strokeForGear({ slot: 'weapon' })).toBe('along_bone');
    expect(strokeForGear({ slot: 'cape' })).toBe('surface_flow');
    expect(GEAR_DAB_SIZE).toEqual([0.03, 0.07]);
    const grip = SCIMITAR_CURVE[0];
    const tip = SCIMITAR_CURVE[SCIMITAR_CURVE.length - 1];
    expect(tip[1]).toBeLessThan(grip[1]);
    expect(gearJitter('bronze')).toBe(0.25);
    expect(gearJitter('cloth')).toBe(0.5);
    for (const id of ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'rune', 'black_metal', 'dragon_metal']) {
      expect(paletteIsUsable(id)).toBe(true);
      const mix = PALETTE_BY_ID[id];
      expect(mix.metal).toBe(true);
    }
  });
});

describe('monster species paint', () => {
  it('gives every species its own usable palette, and bosses a smaller dab', () => {
    for (const typeKey of Object.keys(MONSTER_TYPES)) {
      expect(SPECIES_PAINT[typeKey], typeKey).toBeTruthy();
      const spec = speciesPaint(typeKey);
      expect(paletteIsUsable(spec.palette)).toBe(true);
      const flags = paintFlagsForMesh(typeKey, 'Body');
      expect(flags.noPaint).toBe(false);
      expect(flags.stroke).toBe('surface_flow');
      if (typeKey === 'elvarg_dragon') {
        expect(spec.paintClass).toBe('boss');
        expect(spec.size).toEqual([0.04, 0.09]);
      } else {
        expect(spec.paintClass).toBe('monster');
        expect(spec.size).toEqual([0.06, 0.12]);
      }
    }
    const spear = paintFlagsForMesh('goblin', 'spear shaft');
    expect(spear.stroke).toBe('along_bone');
    expect(spear.palette).toBe('bronze');
    expect(paintFlagsForMesh('goblin', 'eye_l').noPaint).toBe(true);
  });
});
