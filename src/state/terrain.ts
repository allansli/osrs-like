import { WORLD_REGIONS, type RegionDef } from '../data/world';
import { riverCenterX } from './collision';

export function getTerrainHeight(x: number, z: number): number {
  for (const reg of WORLD_REGIONS) {
    const dx = x - reg.x;
    const dz = z - reg.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 16) return 0;
    if (d < 28) {
      const t = (d - 16) / 12;
      const smoothT = t * t * (3 - 2 * t);
      return rawHills(x, z) * smoothT;
    }
  }
  const riverCenter = riverCenterX(z);
  const riverDist = Math.abs(x - riverCenter);
  if (riverDist < 6.8) {
    return -1.45 * Math.cos((riverDist / 6.8) * (Math.PI / 2));
  }
  return rawHills(x, z);
}

export function rawHills(x: number, z: number): number {
  const h1 = Math.sin(x * 0.032) * Math.cos(z * 0.032) * 1.85;
  const h2 = Math.sin(x * 0.085 + z * 0.065) * 0.55;
  let crag = 0;
  if (x < -35 && z > 30) {
    crag = Math.min(6.4, ((-35 - x) + (z - 30)) * 0.06) * (0.6 + 0.4 * Math.sin(x * 0.13) * Math.cos(z * 0.13));
  }
  return Math.max(0.08, (h1 + h2) * 0.55 + 0.85 + crag);
}

export function regionAt(x: number, z: number): RegionDef | null {
  for (const reg of WORLD_REGIONS) {
    const d = Math.hypot(x - reg.x, z - reg.z);
    if (d < reg.radius) {
      return reg;
    }
  }
  return null;
}
