/** River Lum centerline used by both the renderer and the collision tests. */
export function riverCenterX(z: number): number {
  return 28 + Math.sin(z * 0.05) * 8;
}

export interface Aabb {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Lumbridge castle footprint. The structure is built at world (0, -25)
 * with the gate facing +Z toward the courtyard. The gap between the south
 * wall segments is the only walkable entrance.
 */
export function castleBlockers(): Aabb[] {
  const cx = 0;
  const cz = -25;
  const t = 0.7;
  return [
    { minX: cx - 9.6, maxX: cx + 9.6, minZ: cz - 9 - t, maxZ: cz - 9 + t },
    { minX: cx - 9.1, maxX: cx - 1.7, minZ: cz + 8 - t, maxZ: cz + 8 + t },
    { minX: cx + 1.7, maxX: cx + 9.1, minZ: cz + 8 - t, maxZ: cz + 8 + t },
    { minX: cx - 9 - t, maxX: cx - 9 + t, minZ: cz - 9, maxZ: cz + 8 },
    { minX: cx + 9 - t, maxX: cx + 9 + t, minZ: cz - 9, maxZ: cz + 8 },
    { minX: cx - 3.8, maxX: cx + 3.8, minZ: cz - 6.6, maxZ: cz - 0.4 }
  ];
}

export function isDeepWater(x: number, z: number): boolean {
  const dist = Math.abs(x - riverCenterX(z));
  if (dist >= 4.6) return false;
  const onBridge = Math.abs(z) <= 2.05 && x >= 20.5 && x <= 35.5;
  return !onBridge;
}

export function hitsCastleWall(x: number, z: number): boolean {
  for (const box of castleBlockers()) {
    if (x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ) return true;
  }
  return false;
}

export function isWalkable(x: number, z: number): boolean {
  if (x < -118 || x > 118 || z < -118 || z > 118) return false;
  if (isDeepWater(x, z)) return false;
  if (hitsCastleWall(x, z)) return false;
  return true;
}

export function moveWithCollision(x: number, z: number, dx: number, dz: number): { x: number; z: number } {
  const clamp = (v: number) => Math.max(-118, Math.min(118, v));
  const nx = clamp(x + dx);
  const nz = clamp(z + dz);
  if (isWalkable(nx, nz)) return { x: nx, z: nz };
  if (isWalkable(nx, z)) return { x: nx, z };
  if (isWalkable(x, nz)) return { x, z: nz };
  return { x, z };
}
