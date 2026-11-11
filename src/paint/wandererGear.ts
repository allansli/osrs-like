import type { StrokeDir } from './contract';
import { hexToPaint, PALETTE_BY_ID } from './palettes';

/**
 * Equipment slots on the MakeHuman wanderer. Bone local +Y runs toward the child
 * joint: up the spine and head, out along the arms, down the thighs, forward along the feet.
 */
export type GearSlot =
  | 'head'
  | 'cape'
  | 'neck'
  | 'body'
  | 'bodyArm'
  | 'legs'
  | 'legsSide'
  | 'hands'
  | 'feet'
  | 'weapon'
  | 'shield'
  | 'ring';

export type GearSide = 'l' | 'r';

export interface GearPose {
  position: [number, number, number];
  rotation: [number, number, number];
  /** Extra scale after fitScale. Weapons use this alone. */
  scale: number;
  /** Pull the visual's bounding centre onto the bone, then apply position. */
  recenter: boolean;
}

const TIER_PALETTE: Record<string, string> = {
  bronze: 'bronze',
  iron: 'iron',
  steel: 'steel',
  mithril: 'mithril',
  adamant: 'adamant',
  rune: 'rune',
  black: 'black_metal',
  white: 'white_metal',
  gilded: 'gilded',
  dragon: 'dragon_metal',
  barrows: 'barrows',
  bandos: 'bandos',
  raids: 'justiciar',
  botw: 'hylian'
};

export interface GearItemLike {
  id?: string;
  tier?: string;
  slot?: string;
  iconKind?: string;
}

export function boneForSlot(slot: GearSlot, side: GearSide = 'r'): string {
  switch (slot) {
    case 'head': return 'Head';
    case 'cape': return 'spine_03';
    case 'neck': return 'neck_01';
    case 'body': return 'spine_02';
    case 'bodyArm': return side === 'l' ? 'upperarm_l' : 'upperarm_r';
    case 'legs': return 'pelvis';
    case 'legsSide': return side === 'l' ? 'thigh_l' : 'thigh_r';
    case 'hands': return side === 'l' ? 'hand_l' : 'hand_r';
    case 'feet': return side === 'l' ? 'foot_l' : 'foot_r';
    case 'weapon': return 'hand_r';
    case 'shield': return 'lowerarm_l';
    case 'ring': return 'hand_r';
    default: return 'spine_02';
  }
}

export function poseForSlot(slot: GearSlot, silhouette = ''): GearPose {
  if (slot === 'weapon') return weaponPose(silhouette);
  if (slot === 'shield') {
    return { position: [0.02, 0.12, 0.1], rotation: [0.15, 1.15, 0.35], scale: 1, recenter: true };
  }
  if (slot === 'head') {
    return { position: [0, 0.13, 0.02], rotation: [0, 0, 0], scale: 1, recenter: true };
  }
  if (slot === 'cape') {
    return { position: [0, -0.04, -0.1], rotation: [0.2, 0, 0], scale: 1, recenter: true };
  }
  if (slot === 'neck') {
    return { position: [0, 0.02, 0.05], rotation: [0.3, 0, 0], scale: 1, recenter: true };
  }
  if (slot === 'body') {
    return { position: [0, 0.05, 0.03], rotation: [0, 0, 0], scale: 1, recenter: true };
  }
  if (slot === 'bodyArm') {
    return { position: [0, 0.12, 0.01], rotation: [0, 0, 0], scale: 1, recenter: true };
  }
  if (slot === 'legs') {
    return { position: [0, -0.16, 0.02], rotation: [0, 0, 0], scale: 1, recenter: true };
  }
  if (slot === 'legsSide') {
    return { position: [0, 0.22, 0.02], rotation: [0, 0, 0], scale: 1, recenter: true };
  }
  if (slot === 'hands') {
    return { position: [0, 0.06, 0.01], rotation: [0, 0, 0], scale: 1, recenter: true };
  }
  if (slot === 'feet') {
    return { position: [0, 0.05, 0.03], rotation: [0, 0, 0], scale: 1, recenter: true };
  }
  return { position: [0, 0.08, 0.02], rotation: [0, Math.PI / 2, 0], scale: 0.7, recenter: true };
}

function weaponPose(silhouette: string): GearPose {
  const sil = silhouette.toLowerCase();
  if (/bow|crossbow|blowpipe/.test(sil)) {
    return { position: [0, 0.1, 0.02], rotation: [0.35, 0.1, 1.25], scale: 0.62, recenter: false };
  }
  if (/staff|wand|whip/.test(sil)) {
    return { position: [0, 0.08, 0.02], rotation: [0.5, 0, 1.15], scale: 0.58, recenter: false };
  }
  if (/greataxe|greatsword|mace/.test(sil)) {
    return { position: [0, 0.06, 0.03], rotation: [-1.05, 0.2, 1.45], scale: 0.5, recenter: false };
  }
  return { position: [0, 0.1, 0.04], rotation: [-1.15, 0.15, 1.35], scale: 0.72, recenter: false };
}

/** Scale a recentered visual so it wraps the bone instead of floating inside the suit. */
export function fitScale(width: number, slot: GearSlot): number {
  const target: Record<GearSlot, number> = {
    head: 0.46,
    cape: 0.55,
    neck: 0.2,
    body: 0.62,
    bodyArm: 0.18,
    legs: 0.48,
    legsSide: 0.22,
    hands: 0.14,
    feet: 0.22,
    weapon: 0.7,
    shield: 0.42,
    ring: 0.07
  };
  const w = Number.isFinite(width) && width > 0 ? width : 0.2;
  return Math.min(1.85, Math.max(0.4, target[slot] / w));
}

export function paletteForGear(item: GearItemLike): string {
  const id = `${item.id ?? ''} ${item.iconKind ?? ''}`.toLowerCase();
  if (/dhide|dragonhide/.test(id)) return 'dhide';
  if (/^(bronze|iron|steel|mith|addy|rune|dragon|black|white|gilded)_/.test(item.id ?? '')) {
    return TIER_PALETTE[item.tier ?? ''] ?? 'bronze';
  }
  if (item.slot === 'cape' || /cape|cloak/.test(id)) return 'cloth';
  if (/staff|wand/.test(id)) return TIER_PALETTE[item.tier ?? ''] ?? 'timber';
  if (/bow/.test(id)) return /rune|crystal/.test(id) ? (TIER_PALETTE[item.tier ?? ''] ?? 'rune') : 'timber';
  if (/wooden/.test(id)) return 'timber';
  if (/leather|vamb|glove|boot|bracer/.test(id)) return 'leather';
  return TIER_PALETTE[item.tier ?? ''] ?? 'bronze';
}

export function strokeForGear(item: GearItemLike): StrokeDir {
  if (item.slot === 'cape') return 'surface_flow';
  return 'along_bone';
}

export const GEAR_DAB_SIZE: [number, number] = [0.03, 0.07];

export function gearJitter(paletteId: string): number {
  return PALETTE_BY_ID[paletteId]?.metal ? 0.25 : 0.5;
}

/** Three mixes for the cloth cloak. No cape keeps the demo blue. A cape retints that same cloth. */
export function capePaint(color?: number | null): [number, number, number][] {
  if (color == null) {
    const palette = PALETTE_BY_ID.wanderer_cloak;
    return [hexToPaint(palette.light), hexToPaint(palette.half), hexToPaint(palette.shade)];
  }
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;
  const lift = (channel: number) => Math.min(1, channel + (1 - channel) * 0.35);
  const sink = (channel: number) => channel * 0.45 + 0.05;
  return [
    [lift(r), lift(g), lift(b)],
    [r, g, b],
    [sink(r), sink(g), sink(b)]
  ];
}
