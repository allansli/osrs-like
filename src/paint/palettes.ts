/** Three mixes of paint: light, half-tone, shade. Hex is sRGB, written as it should look. */

export interface Palette {
  id: string;
  light: string;
  half: string;
  shade: string;
  /** Design / UX replaces these. The spike mixes above are locked. */
  placeholder: boolean;
  /** Tighter broken colour. Default jitter 0.25 instead of 0.5. */
  metal: boolean;
}

export type MixHex = readonly [string, string, string];

/** Locked by art direction. Do not retint these in code. */
export const LOCKED_PALETTES: Record<string, MixHex> = {
  meadow_grass: ['#B9C46A', '#7E9443', '#3F5A33'],
  dirt_path: ['#C9A877', '#8E6B45', '#4E3A2C'],
  kai_skin: ['#F2CFAE', '#C9946F', '#7A4E3E'],
  kai_hair: ['#5A3A2A', '#3A2419', '#1E1210'],
  kai_tunic: ['#6F8FB0', '#45607E', '#26354A'],
  goblin_hide: ['#9DB05A', '#647A36', '#33421F'],
  bronze: ['#E0A862', '#A8703A', '#5A3A22'],
  leather: ['#A87B4F', '#6E4A2E', '#3A2618'],
  // The oil-paint demo's cloak. Saturated blue on purpose; the shade is blue, not black.
  wanderer_cloak: ['#3D80BD', '#1C4585', '#121C4D']
};

function locked(id: keyof typeof LOCKED_PALETTES, metal = false): Palette {
  const [light, half, shade] = LOCKED_PALETTES[id];
  return { id, light, half, shade, placeholder: false, metal };
}

/** Stand-ins. Each shade is a coloured dark, never black. */
function placeholder(id: string, light: string, half: string, shade: string, metal = false): Palette {
  return { id, light, half, shade, placeholder: true, metal };
}

export const PALETTES: readonly Palette[] = [
  locked('meadow_grass'),
  locked('dirt_path'),
  locked('kai_skin'),
  locked('kai_hair'),
  locked('kai_tunic'),
  locked('goblin_hide'),
  locked('bronze', true),
  locked('leather'),
  // The demo's cloak, not a fallback: a saturated blue, shade still blue and never black.
  locked('wanderer_cloak'),
  placeholder('alkharid_sand', '#E8D5A3', '#C4A46A', '#7A6238'),
  placeholder('varrock_stone', '#C5C8CE', '#8E949E', '#4A5563'),
  placeholder('volcanic', '#6E625C', '#4A3E3A', '#2C3834'),
  placeholder('pine_bark', '#8A6A45', '#5C4630', '#2E3A28'),
  placeholder('iron', '#C5C8CE', '#8A9098', '#3E4A55', true),
  placeholder('steel', '#D5D8DE', '#9AA3AD', '#3A4552', true),
  placeholder('mithril', '#9FD0D8', '#5E8E9A', '#2A4550', true),
  placeholder('adamant', '#7EC88A', '#3E7A4A', '#1E3A2C', true),
  placeholder('rune', '#6AA0E0', '#3A6498', '#1E3050', true),
  placeholder('cloth', '#D9CBB8', '#A89480', '#5C4A3C'),
  placeholder('skin', '#F0C8A8', '#C48A68', '#6A4034'),
  placeholder('river_opaque', '#7AA4A0', '#4E7574', '#2A4548'),
  placeholder('chicken_feather', '#F4E2A8', '#C4A15A', '#4A5640'),
  placeholder('castle_stone', '#C9C3B4', '#8E8A82', '#3E4A52'),
  placeholder('timber', '#C4A06A', '#8A6240', '#3A4034'),
  placeholder('foliage', '#9BB56A', '#5E7A3E', '#2C4630'),
  placeholder('black_metal', '#6A7580', '#3E4A56', '#243038', true),
  placeholder('white_metal', '#F4F1E6', '#C9C3B2', '#6E7A70', true),
  placeholder('gilded', '#E2C278', '#A8843C', '#4A5830', true),
  placeholder('dragon_metal', '#C45A3A', '#8A3428', '#3A2C28', true),
  placeholder('barrows', '#7A8A62', '#4A5A3C', '#2A3830', true),
  placeholder('bandos', '#C4A06A', '#7A5A38', '#3A4030', true),
  placeholder('justiciar', '#D5D8DE', '#8A9AAB', '#3A4A58', true),
  placeholder('hylian', '#3A8A55', '#245A38', '#1E3428'),
  placeholder('dhide', '#6A9A48', '#3E6A30', '#243828'),
  placeholder('scorpion_chitin', '#D4924A', '#8A5A28', '#3A4030'),
  placeholder('wizard_robe', '#7A6AAB', '#4A3A72', '#2A3048'),
  placeholder('ranger_leather', '#4A6A48', '#2E4630', '#243028'),
  placeholder('moss', '#8A9A62', '#4A6238', '#2A3830'),
  placeholder('demon_hide', '#D25A48', '#8A342C', '#3A2828'),
  placeholder('dragon_scale', '#3E9A55', '#246838', '#1A3428')
];

export const PALETTE_BY_ID: Record<string, Palette> = Object.fromEntries(PALETTES.map((p) => [p.id, p]));

/** sRGB byte values in 0..1. The oil renderer writes these as paint and does not tone-map them. */
export function hexToPaint(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function paletteIndex(id: string): number {
  const i = PALETTES.findIndex((p) => p.id === id);
  return i < 0 ? 0 : i;
}
