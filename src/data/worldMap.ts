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

// Design 6.3. Each path starts where its signpost stands (a town exit or a fork) and ends near its shrine.
export const PATHS: PathDef[] = [
  { id: 'millrace_road', name: 'Millrace Road', halfWidth: 2, points: [[12, 2], [18, 0], [38, 0], [50, -6], [64, -16], [72, -22]] },
  { id: 'saltwind_track', name: 'Saltwind Track', halfWidth: 1.8, points: [[40, 0], [50, 10], [62, 30], [68, 48], [68, 55]] },
  { id: 'lanternway', name: 'Lanternway', halfWidth: 1.8, points: [[-14, -4], [-28, -10], [-44, -16], [-58, -26], [-68, -33]] },
  { id: 'cinder_stair', name: 'Cinder Stair', halfWidth: 1.8, points: [[-6, 12], [-12, 32], [-14, 55], [-46, 55], [-56, 58], [-64, 61]] }
];

// Harrowback Ridge closes the volcanic corner; both ends run past the walkable bound. Its one gap is Cinderstep Pass,
// 5 wide and 22 long (twice the core half-width).
export const RIDGES: RidgeDef[] = [
  {
    id: 'harrowback_ridge',
    name: 'Harrowback Ridge',
    points: [[-124, 22], [-38, 30], [-32, 38], [-32, 124]],
    height: 12,
    halfWidth: 18,
    coreHalfWidth: 11,
    gaps: [{ at: [-32, 55], halfWidth: 2.5 }]
  }
];

export const BASINS: BasinDef[] = [
  { id: 'reedglass_tarn', name: 'Reedglass Tarn', x: -40, z: -30, radius: 6, depth: 1.2 },
  { id: 'tamarisk_pool', name: 'Tamarisk Pool', x: 96, z: 90, radius: 6, depth: 1.2 }
];

export const POIS: PoiDef[] = [
  {
    id: 'three_kettle_camp', name: 'Three Kettle Camp', x: 13, z: 8, padRadius: 5,
    pieces: [
      { builder: 'tent', dx: -2.5, dz: 2.5, rot: 0.4 },
      { builder: 'tent', dx: 2.5, dz: 3, rot: -0.5 },
      { builder: 'fireRing', dx: 0, dz: 0 },
      { node: 'World_crate', dx: 3.2, dz: -1.8, rot: 0.3 },
      { node: 'World_barrel', dx: -3.2, dz: -1.6 },
      { node: 'World_bag_grain', dx: 1, dz: -3.4, rot: 1.1 }
    ]
  },
  {
    id: 'wardstone_cairn', name: 'Wardstone Cairn', x: -8, z: 50, padRadius: 2,
    pieces: [
      { builder: 'cairn', dx: 0, dz: 0 },
      { node: 'World_plaza_pillar', dx: 1.2, dz: 1, scale: 0.6 },
      { node: 'World_woods_lantern', dx: -1.2, dz: 1.2 }
    ],
    sign: 'Beyond this cairn the pass is held. Go through prepared, or not at all.'
  },
  {
    id: 'cinderstep_pass', name: 'Cinderstep Pass', x: -19, z: 55, padRadius: 3,
    pieces: [
      { node: 'World_obsidian_spire', dx: 0, dz: 2.9 },
      { node: 'World_obsidian_spire', dx: 0, dz: -2.9, rot: 1.6 }
    ]
  },
  {
    id: 'slagfall_terrace', name: 'Slagfall Terrace', x: -84, z: 98, padRadius: 6,
    pieces: [
      { node: 'World_obsidian_spire', dx: -3.5, dz: 2.5 },
      { node: 'World_lava_fissure', dx: 2, dz: -1.5, rot: 0.7 },
      { node: 'World_obsidian_spire', dx: 3.8, dz: 3, scale: 0.8 }
    ]
  },
  {
    id: 'lampwrights_hollow', name: "Lampwright's Hollow", x: -50, z: -13, padRadius: 2.5,
    pieces: [
      { node: 'World_woods_lantern', dx: -1.5, dz: 0.5 },
      { node: 'World_mystic_mushroom', dx: 1.2, dz: 1.2 },
      { node: 'World_crate', dx: 0.8, dz: -1.4, rot: 0.5 }
    ]
  },
  { id: 'reedglass_tarn', name: 'Reedglass Tarn', x: -29, z: -30, padRadius: 0, pieces: [] },
  {
    id: 'tamarisk_pool', name: 'Tamarisk Pool', x: 85, z: 90, padRadius: 2.5,
    pieces: [
      { node: 'World_palm_tree', dx: 0, dz: 1.5 },
      { node: 'World_sandstone_arch', dx: 1, dz: -1.2, rot: 1.57 }
    ]
  }
];

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
