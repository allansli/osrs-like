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
  leather: ['#A87B4F', '#6E4A2E', '#3A2618']
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
  placeholder('river_opaque', '#7AA4A0', '#4E7574', '#2A4548')
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
