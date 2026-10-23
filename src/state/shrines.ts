import { WORLD_REGIONS, type RegionDef } from '../data/world';

export const SHRINE_DISCOVERY_RANGE = 12;

export function shrineWorldPos(region: RegionDef): { x: number; z: number } {
  return { x: region.x, z: region.z - 6 };
}

export function initialShrines(): Record<string, boolean> {
  const found: Record<string, boolean> = {};
  for (const region of WORLD_REGIONS as RegionDef[]) {
    found[region.id] = region.id === 'lumbridge';
  }
  return found;
}

export function discoverShrines(x: number, z: number, current: Record<string, boolean>): { shrines: Record<string, boolean>; unlocked: string[] } {
  const shrines: Record<string, boolean> = { ...initialShrines(), ...current, lumbridge: true };
  const unlocked: string[] = [];
  for (const region of WORLD_REGIONS as RegionDef[]) {
    if (shrines[region.id]) continue;
    const pos = shrineWorldPos(region);
    if (Math.hypot(x - pos.x, z - pos.z) <= SHRINE_DISCOVERY_RANGE) {
      shrines[region.id] = true;
      unlocked.push(region.id);
    }
  }
  return { shrines, unlocked };
}

export function isShrineDiscovered(shrines: Record<string, boolean>, regionId: string): boolean {
  return !!shrines[regionId];
}
