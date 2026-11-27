// Look data and graphics tier definitions (design 5.3, 6.2, 10).

export interface DayKey {
  phase: number;
  sunElevationDeg: number;
  key: string;
  keyIntensity: number;
  zenith: string;
  horizon: string;
  air: string;
  fill: string;
  bounce: string;
  exposure: number;
}

export const DAY_KEYS: DayKey[] = [
  {
    phase: 0.00,
    sunElevationDeg: 50,
    key: '#8fa8d8',
    keyIntensity: 0.5,
    zenith: '#050916',
    horizon: '#101a2f',
    air: '#18243c',
    fill: '#2a3a66',
    bounce: '#141a22',
    exposure: 2.9,
  },
  {
    phase: 0.25,
    sunElevationDeg: 4,
    key: '#ffb38a',
    keyIntensity: 0.43,
    zenith: '#2d3e6b',
    horizon: '#c48f71',
    air: '#c9a9a0',
    fill: '#6f7fb0',
    bounce: '#4a3f3a',
    exposure: 1.75,
  },
  {
    phase: 0.33,
    sunElevationDeg: 28,
    key: '#ffe2b8',
    keyIntensity: 0.76,
    zenith: '#31609d',
    horizon: '#98aebe',
    air: '#b5cde0',
    fill: '#8fb2dc',
    bounce: '#5a5a48',
    exposure: 1.6,
  },
  {
    phase: 0.50,
    sunElevationDeg: 62,
    key: '#fff4dc',
    keyIntensity: 0.95,
    zenith: '#25599e',
    horizon: '#89a6be',
    air: '#a8c6e0',
    fill: '#9cc0ea',
    bounce: '#6a6a4e',
    exposure: 1.6,
  },
  {
    phase: 0.70,
    sunElevationDeg: 16,
    key: '#ffc070',
    keyIntensity: 0.81,
    zenith: '#2d4b86',
    horizon: '#c7a26e',
    air: '#e2b890',
    fill: '#7f8fc4',
    bounce: '#5c4a38',
    exposure: 1.69,
  },
  {
    phase: 0.77,
    sunElevationDeg: 2,
    key: '#ff8a5c',
    keyIntensity: 0.38,
    zenith: '#222859',
    horizon: '#c37055',
    air: '#a8788a',
    fill: '#5a5c9c',
    bounce: '#3a2f38',
    exposure: 1.84,
  },
];

export const CAVE_LIGHT: DayKey = {
  phase: 0,
  sunElevationDeg: 90,
  key: '#ff7a3a',
  keyIntensity: 0.3,
  zenith: '#2a120c',
  horizon: '#2a120c',
  air: '#3b1a12',
  fill: '#120a1a',
  bounce: '#ff6a1f',
  exposure: 1.2,
};

export const CAVE_FOG_SCALE = 3;

// Gain on the grass weight of the ground shader: the painted meadow albedo is dark (about 0.05
// linear), so it is lifted here instead of through a global exposure that also lifts every other region.
export const GROUND_GRASS_GAIN = 3.0;

export const DAY_CLOCK = {
  dayMinutes: 24,
  nightSpeed: 2,
  sunDownBelow: 0.22,
  sunDownFrom: 0.82,
};

export const PRESET_PHASE = [0.70, 0.50, 0.00];

export type QualityTier = 'performance' | 'balanced' | 'high' | 'ultra';

export interface GfxTier {
  pixelRatioCap: number;
  megapixelCap: number;
  shadowSize: number;
  shadowRange: number;
  composer: boolean;
  composerSamples: number;
  composerSamplesAbove83Mp: number;
  shadowFade: boolean;
  terrainCasts: boolean;
  cloudShadows: boolean;
  airHeightSunLeanRegionTint: boolean;
  skyStarsHorizonGlow: boolean;
  clouds: boolean;
  waterMode: 'ramp' | 'full';
  glowingEffects: boolean;
  anisotropy: number;
  carpetTufts: number;
  scatterDensity: number;
  motes: number;
  weatherParticles: number;
  pointLights: number;
}

export const GFX_TIERS: Record<QualityTier, GfxTier> = {
  performance: {
    pixelRatioCap: 1,
    megapixelCap: 3.7,
    shadowSize: 0,
    shadowRange: 0,
    composer: false,
    composerSamples: 0,
    composerSamplesAbove83Mp: 0,
    shadowFade: false,
    terrainCasts: false,
    cloudShadows: false,
    airHeightSunLeanRegionTint: false,
    skyStarsHorizonGlow: false,
    clouds: false,
    waterMode: 'ramp',
    glowingEffects: false,
    anisotropy: 1,
    carpetTufts: 0,
    scatterDensity: 0.5,
    motes: 0,
    weatherParticles: 0,
    pointLights: 0,
  },
  balanced: {
    pixelRatioCap: 1.25,
    megapixelCap: 6,
    shadowSize: 2048,
    shadowRange: 40,
    composer: false,
    composerSamples: 0,
    composerSamplesAbove83Mp: 0,
    shadowFade: true,
    terrainCasts: true,
    cloudShadows: false,
    airHeightSunLeanRegionTint: true,
    skyStarsHorizonGlow: true,
    clouds: true,
    waterMode: 'full',
    glowingEffects: false,
    anisotropy: 4,
    carpetTufts: 6000,
    scatterDensity: 0.75,
    motes: 150,
    weatherParticles: 600,
    pointLights: 0,
  },
  high: {
    pixelRatioCap: 1.5,
    megapixelCap: 8.3,
    shadowSize: 2048,
    shadowRange: 54,
    composer: true,
    composerSamples: 4,
    composerSamplesAbove83Mp: 4,
    shadowFade: true,
    terrainCasts: true,
    cloudShadows: true,
    airHeightSunLeanRegionTint: true,
    skyStarsHorizonGlow: true,
    clouds: true,
    waterMode: 'full',
    glowingEffects: true,
    anisotropy: 8,
    carpetTufts: 14000,
    scatterDensity: 1,
    motes: 400,
    weatherParticles: 1500,
    pointLights: 2,
  },
  ultra: {
    pixelRatioCap: 2,
    megapixelCap: 16.6,
    shadowSize: 4096,
    shadowRange: 70,
    composer: true,
    composerSamples: 4,
    composerSamplesAbove83Mp: 2,
    shadowFade: true,
    terrainCasts: true,
    cloudShadows: true,
    airHeightSunLeanRegionTint: true,
    skyStarsHorizonGlow: true,
    clouds: true,
    waterMode: 'full',
    glowingEffects: true,
    anisotropy: 16,
    carpetTufts: 24000,
    scatterDensity: 1,
    motes: 800,
    weatherParticles: 3000,
    pointLights: 4,
  },
};

export const CAMERA_FAR = 460;
export const SKY_DOME_RADIUS = 440;
/** Cloud solids per cloud shape (one InstancedMesh per shape). */
export const CLOUD_INSTANCES_PER_VARIANT = 8;
export const HORIZON_APRON = { inner: 130, outer: 240 };
export const CAMERA_LIMITS = { pitchMin: 0.12, pitchMax: 1.15, distanceMin: 3.6, distanceMax: 26 };
export const WALK_BOUND = 118;
export const SHADOW_SUN_STEP_DEG = 0.5;
export const SHADOW_BIAS = -0.0004;
export const SHADOW_NORMAL_BIAS = 0.08;

export interface RegionLook {
  id: string;
  airTint: string;
  airWeight: number;
}

// Air tint per region (design 5.5), in WORLD_REGIONS order; the weight is the most the air leans to the tint.
export const REGION_LOOK: RegionLook[] = [
  { id: 'lumbridge', airTint: '#ffffff', airWeight: 0 },
  { id: 'varrock', airTint: '#c4d4ec', airWeight: 0.1 },
  { id: 'desert', airTint: '#e8c48e', airWeight: 0.18 },
  { id: 'woods', airTint: '#6fae9c', airWeight: 0.2 },
  { id: 'wilderness', airTint: '#8e82a0', airWeight: 0.18 },
];

export interface WeatherMote {
  color: string;
  intensity: number;
  glow?: boolean;
}

export interface WeatherFall {
  color: string;
}

export interface WeatherDef {
  id: string;
  regions: string[];
  keyScale: number;
  fogScale: number;
  motes: WeatherMote[];
  fall: WeatherFall | null;
}

export const WEATHER: WeatherDef[] = [
  {
    id: 'clear',
    regions: ['lumbridge', 'varrock', 'desert', 'woods', 'wilderness'],
    keyScale: 1.0,
    fogScale: 1.0,
    motes: [
      { color: '#d8e8a8', intensity: 0.8 },
      { color: '#aaff44', intensity: 3.0, glow: true },
    ],
    fall: null,
  },
  {
    id: 'overcast',
    regions: ['lumbridge', 'varrock', 'woods'],
    keyScale: 0.65,
    fogScale: 1.3,
    motes: [
      { color: '#b0bcc8', intensity: 0.6 },
    ],
    fall: null,
  },
  {
    id: 'mist',
    regions: ['lumbridge', 'varrock', 'woods'],
    keyScale: 0.8,
    fogScale: 2.0,
    motes: [
      { color: '#c8d8e8', intensity: 0.7 },
      { color: '#aaff44', intensity: 3.0, glow: true },
    ],
    fall: null,
  },
  {
    id: 'rain',
    regions: ['lumbridge', 'varrock', 'woods'],
    keyScale: 0.5,
    fogScale: 1.6,
    motes: [
      { color: '#a8c0d8', intensity: 0.7 },
    ],
    fall: { color: '#90b8e0' },
  },
  {
    id: 'sand_haze',
    regions: ['desert'],
    keyScale: 0.7,
    fogScale: 1.8,
    motes: [
      { color: '#d8b470', intensity: 0.9 },
    ],
    fall: { color: '#c8a870' },
  },
  {
    id: 'ash_fall',
    regions: ['wilderness'],
    keyScale: 0.6,
    fogScale: 1.5,
    motes: [
      { color: '#ff6622', intensity: 8.0, glow: true },
      { color: '#888080', intensity: 0.5 },
    ],
    fall: { color: '#706868' },
  },
];

export interface EmitterDef {
  node: string;
  color: string;
  intensity: number;
}

export const EMITTERS: EmitterDef[] = [
  { node: 'World_woods_lantern', color: '#ffbb55', intensity: 4.0 },
  { node: 'World_forge', color: '#ff7733', intensity: 6.0 },
  { node: 'World_lava_fissure', color: '#ff5522', intensity: 8.0 },
  { node: 'World_shrine', color: '#55ddff', intensity: 4.0 },
  { node: 'World_mystic_mushroom', color: '#66ffaa', intensity: 3.0 },
];

export type KitPieceId =
  | 'boulder_s'
  | 'boulder_m'
  | 'boulder_l'
  | 'bush_a'
  | 'bush_b'
  | 'fern'
  | 'reed'
  | 'log'
  | 'snag'
  | 'sapling'
  | 'mushrooms'
  | 'backdrop_tree_a'
  | 'backdrop_tree_b'
  | 'crag_a'
  | 'crag_b';

export interface KitPieceDef {
  layer: 'understorey' | 'canopy';
  maxHeight: number;
  radius: number;
  tintFamily: 'stone' | 'foliage' | 'wood' | 'fungus';
  castShadow: boolean;
}

export const KIT_PIECES: Record<KitPieceId, KitPieceDef> = {
  boulder_s: { layer: 'understorey', maxHeight: 0.5, radius: 0.5, tintFamily: 'stone', castShadow: false },
  boulder_m: { layer: 'understorey', maxHeight: 0.8, radius: 0.8, tintFamily: 'stone', castShadow: true },
  boulder_l: { layer: 'understorey', maxHeight: 1.2, radius: 1.1, tintFamily: 'stone', castShadow: true },
  bush_a: { layer: 'understorey', maxHeight: 0.9, radius: 0.7, tintFamily: 'foliage', castShadow: false },
  bush_b: { layer: 'understorey', maxHeight: 1.1, radius: 0.9, tintFamily: 'foliage', castShadow: false },
  fern: { layer: 'understorey', maxHeight: 0.7, radius: 0.5, tintFamily: 'foliage', castShadow: false },
  reed: { layer: 'understorey', maxHeight: 1.2, radius: 0.4, tintFamily: 'foliage', castShadow: false },
  log: { layer: 'understorey', maxHeight: 0.6, radius: 0.8, tintFamily: 'wood', castShadow: false },
  snag: { layer: 'canopy', maxHeight: 4.5, radius: 1.2, tintFamily: 'wood', castShadow: true },
  sapling: { layer: 'understorey', maxHeight: 1.2, radius: 0.6, tintFamily: 'wood', castShadow: false },
  mushrooms: { layer: 'understorey', maxHeight: 0.4, radius: 0.4, tintFamily: 'fungus', castShadow: false },
  backdrop_tree_a: { layer: 'canopy', maxHeight: 9.0, radius: 1.8, tintFamily: 'wood', castShadow: true },
  backdrop_tree_b: { layer: 'canopy', maxHeight: 11.0, radius: 2.0, tintFamily: 'wood', castShadow: true },
  crag_a: { layer: 'canopy', maxHeight: 6.0, radius: 1.6, tintFamily: 'stone', castShadow: true },
  crag_b: { layer: 'canopy', maxHeight: 8.0, radius: 2.0, tintFamily: 'stone', castShadow: true },
};

export interface RegionFloraRule {
  pieces: KitPieceId[];
  clusterDensity: number;
}

export interface PoiFloraRule {
  frame: KitPieceId[];
  focus: number;
  floor: string;
  pieces: KitPieceId[];
}

export type FloraRule = RegionFloraRule | PoiFloraRule;

export const FLORA_RULES: Record<string, FloraRule> = {
  lumbridge: {
    pieces: ['bush_a', 'bush_b', 'boulder_s', 'boulder_m', 'sapling', 'log', 'reed'],
    clusterDensity: 1.0,
  },
  varrock: {
    pieces: ['bush_a', 'boulder_s', 'boulder_m', 'sapling'],
    clusterDensity: 0.8,
  },
  desert: {
    pieces: ['boulder_s', 'boulder_m', 'boulder_l', 'bush_b', 'log'],
    clusterDensity: 0.5,
  },
  woods: {
    pieces: ['fern', 'mushrooms', 'sapling', 'log', 'bush_a', 'bush_b', 'boulder_s'],
    clusterDensity: 1.6,
  },
  wilderness: {
    pieces: ['boulder_s', 'boulder_m', 'boulder_l', 'log'],
    clusterDensity: 0.4,
  },
  three_kettle_camp: {
    frame: ['backdrop_tree_a', 'sapling', 'boulder_l'],
    focus: 5,
    floor: 'trampled dirt',
    pieces: ['sapling', 'boulder_l', 'boulder_s'],
  },
  wardstone_cairn: {
    frame: ['crag_a', 'backdrop_tree_a'],
    focus: 2,
    floor: 'stone paving',
    pieces: ['boulder_s', 'boulder_m', 'bush_a'],
  },
  cinderstep_pass: {
    frame: ['crag_a', 'crag_b', 'snag'],
    focus: 3,
    floor: 'cracked basalt',
    pieces: ['boulder_s', 'boulder_m'],
  },
  slagfall_terrace: {
    frame: ['crag_b', 'snag', 'crag_a'],
    focus: 6,
    floor: 'ash',
    pieces: ['boulder_m', 'boulder_l'],
  },
  lampwrights_hollow: {
    frame: ['backdrop_tree_b', 'backdrop_tree_a'],
    focus: 2.5,
    floor: 'moss',
    pieces: ['mushrooms', 'fern', 'bush_b', 'log'],
  },
  reedglass_tarn: {
    frame: ['backdrop_tree_a', 'reed'],
    focus: 0,
    floor: 'wet stones',
    pieces: ['reed', 'bush_a', 'boulder_s'],
  },
  tamarisk_pool: {
    frame: ['crag_a', 'bush_b'],
    focus: 2.5,
    floor: 'wet stones',
    pieces: ['bush_b', 'boulder_s', 'reed'],
  },
};

export interface BloomConfig {
  threshold: number;
  strength: number;
  radius: number;
}

export const BLOOM: BloomConfig = {
  threshold: 1.35,
  strength: 0.5,
  radius: 0.4,
};
