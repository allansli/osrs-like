import { isDeepWater } from '../state/collision';

/**
 * What the ground dabs are. Derived from the same tests the gouache terrain
 * used (`getBiomeColor` in the runtime) plus the river from collision.
 * Varrock, outside its dirt disk, is laid stone so that palette is on the ground.
 */
export type GroundKind = 'meadow' | 'path' | 'sand' | 'stone' | 'volcanic' | 'pine' | 'river';

/** Byte stored in tLand's blue channel. The ground shader thresholds these. */
export const KIND_BYTE: Record<GroundKind, number> = {
  meadow: 0,
  path: 40,
  sand: 80,
  stone: 120,
  volcanic: 160,
  pine: 200,
  river: 240
};

export function classifyGround(x: number, z: number, h: number): GroundKind {
  if (isDeepWater(x, z)) return 'river';
  if (h < -0.05) return 'path';
  if (z > -22 && z < 8 && x > -8 && x < 82 && Math.abs(z - (-x * 0.22)) < 2.6) return 'path';
  if (Math.hypot(x - 78, z + 20) < 18) return 'path';
  if (x > 40 && z > 36) return 'sand';
  if (x < -40 && z > 36) return 'volcanic';
  if (x < -40 && z < 0) return 'pine';
  if (Math.hypot(x - 78, z + 20) < 44) return 'stone';
  return 'meadow';
}
