import { WORLD_REGIONS } from './world';

export type PathDef = {
  id: string;
  name: string;
  points: [number, number][];
  halfWidth: number;
};

export type RidgeDef = {
  id: string;
  name: string;
  points: [number, number][];
  height: number;
  halfWidth: number;
  coreHalfWidth: number;
  gaps: { at: [number, number]; halfWidth: number }[];
};

export type BasinDef = {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  depth: number;
};

export type PoiPiece = {
  node?: string;
  builder?: string;
  dx: number;
  dz: number;
  rot?: number;
  scale?: number;
};

export type PoiDef = {
  id: string;
  name: string;
  x: number;
  z: number;
  padRadius: number;
  pieces: PoiPiece[];
  sign?: string;
};

export type CampMember = {
  type: string;
  x: number;
  z: number;
  wander?: number;
};

export type CampDef = {
  id: string;
  x: number;
  z: number;
  radius: number;
  aggressive: boolean;
  aggroRadius?: number;
  members: CampMember[];
};

export type SafeZoneDef = {
  id: string;
  x: number;
  z: number;
  radius: number;
};

export const PATHS: PathDef[] = [];
export const RIDGES: RidgeDef[] = [];
export const BASINS: BasinDef[] = [];
export const POIS: PoiDef[] = [];

function makeCamp(id: string, members: CampMember[]): CampDef {
  const count = members.length;
  const cx = members.reduce((s, m) => s + m.x, 0) / count;
  const cz = members.reduce((s, m) => s + m.z, 0) / count;
  const maxDist = Math.max(...members.map((m) => Math.hypot(m.x - cx, m.z - cz)));
  return {
    id,
    x: cx,
    z: cz,
    radius: Math.ceil(maxDist + 4.5),
    aggressive: false,
    members
  };
}

export const CAMPS: CampDef[] = [
  makeCamp('hen_yard', [
    { type: 'chicken', x: -13, z: 4 },
    { type: 'chicken', x: -16, z: 10 },
    { type: 'chicken', x: -11, z: 14 },
    { type: 'chicken', x: -17, z: 17 }
  ]),
  makeCamp('three_kettle', [
    { type: 'goblin', x: 12, z: 4 },
    { type: 'goblin', x: 15, z: 11 },
    { type: 'goblin', x: 18, z: 17 },
    { type: 'goblin', x: 10, z: 19 },
    { type: 'goblin', x: 20, z: 8 },
    { type: 'goblin_archer', x: 24, z: 13 },
    { type: 'goblin_archer', x: 27, z: 19 }
  ]),
  makeCamp('wizards', [
    { type: 'dark_wizard', x: 62, z: -6 },
    { type: 'dark_wizard', x: 68, z: -2 },
    { type: 'dark_wizard', x: 58, z: -14 }
  ]),
  makeCamp('rangers', [
    { type: 'dark_ranger', x: 74, z: -10 },
    { type: 'dark_ranger', x: 80, z: -4 }
  ]),
  makeCamp('giants', [
    { type: 'hill_giant', x: 88, z: -36 },
    { type: 'hill_giant', x: 96, z: -28 },
    { type: 'hill_giant', x: 82, z: -42 },
    { type: 'hill_giant', x: 95, z: -40 }
  ]),
  makeCamp('scorpions', [
    { type: 'scorpion', x: 52, z: 54 },
    { type: 'scorpion', x: 60, z: 76 },
    { type: 'scorpion', x: 76, z: 58 },
    { type: 'scorpion', x: 82, z: 72 },
    { type: 'scorpion', x: 68, z: 84 }
  ]),
  makeCamp('guardians', [
    { type: 'moss_guardian', x: -64, z: -18 },
    { type: 'moss_guardian', x: -82, z: -22 },
    { type: 'moss_guardian', x: -70, z: -44 },
    { type: 'moss_guardian', x: -86, z: -38 }
  ]),
  makeCamp('demons', [
    { type: 'lesser_demon', x: -56, z: 56 },
    { type: 'lesser_demon', x: -64, z: 78 },
    { type: 'lesser_demon', x: -82, z: 58 },
    { type: 'lesser_demon', x: -58, z: 84 }
  ]),
  makeCamp('dragon', [
    { type: 'elvarg_dragon', x: -82, z: 82 }
  ])
];

export const SAFE_ZONES: SafeZoneDef[] = WORLD_REGIONS.map((reg) => ({
  id: reg.id,
  x: reg.x,
  z: reg.z,
  radius: 14
}));

export function isInSafeZone(x: number, z: number): boolean {
  return SAFE_ZONES.some((sz) => Math.hypot(x - sz.x, z - sz.z) <= sz.radius);
}
