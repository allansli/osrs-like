import type { PaintClass, StrokeDir } from './contract';

/** One palette per species. Shades lean blue or green and stay off black. */
export const SPECIES_PAINT: Record<string, { palette: string; paintClass: Extract<PaintClass, 'monster' | 'boss'> }> = {
  chicken: { palette: 'chicken_feather', paintClass: 'monster' },
  goblin: { palette: 'goblin_hide', paintClass: 'monster' },
  goblin_archer: { palette: 'goblin_hide', paintClass: 'monster' },
  scorpion: { palette: 'scorpion_chitin', paintClass: 'monster' },
  dark_wizard: { palette: 'wizard_robe', paintClass: 'monster' },
  dark_ranger: { palette: 'ranger_leather', paintClass: 'monster' },
  hill_giant: { palette: 'skin', paintClass: 'monster' },
  moss_guardian: { palette: 'moss', paintClass: 'monster' },
  lesser_demon: { palette: 'demon_hide', paintClass: 'monster' },
  elvarg_dragon: { palette: 'dragon_scale', paintClass: 'boss' }
};

const MONSTER_SIZE: [number, number] = [0.06, 0.12];
const BOSS_SIZE: [number, number] = [0.04, 0.09];

export interface SpeciesMeshPaint {
  palette: string;
  stroke: StrokeDir;
  size: [number, number];
  paintClass: Extract<PaintClass, 'monster' | 'boss'>;
  noPaint: boolean;
}

export function speciesPaint(typeKey: string): { palette: string; paintClass: 'monster' | 'boss'; size: [number, number] } {
  const spec = SPECIES_PAINT[typeKey] ?? SPECIES_PAINT.goblin;
  return {
    palette: spec.palette,
    paintClass: spec.paintClass,
    size: spec.paintClass === 'boss' ? BOSS_SIZE : MONSTER_SIZE
  };
}

/** Fur, hide, feathers and scales flow over the surface. Blades run along the bone. */
export function paintFlagsForMesh(typeKey: string, name: string): SpeciesMeshPaint {
  const spec = speciesPaint(typeKey);
  const blob = name.toLowerCase();
  if (/eye|pupil/.test(blob)) {
    return { ...spec, stroke: 'surface_flow', noPaint: true };
  }
  if (/sword|spear|bow|staff|claw|sting|blade|buckler|axe/.test(blob)) {
    return { ...spec, palette: 'bronze', stroke: 'along_bone', size: [0.03, 0.07], noPaint: false };
  }
  if (/cloth|robe|hood|cape|wizard/.test(blob) && typeKey !== 'dark_wizard') {
    return { ...spec, palette: 'cloth', stroke: 'along_bone', noPaint: false };
  }
  return { ...spec, stroke: 'surface_flow', noPaint: false };
}
