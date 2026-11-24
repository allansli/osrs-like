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
    zenith: '#03050f',
    horizon: '#0a1223',
    air: '#18243c',
    fill: '#2a3a66',
    bounce: '#141a22',
    exposure: 5.0,
  },
  {
    phase: 0.25,
    sunElevationDeg: 4,
    key: '#ffb38a',
    keyIntensity: 0.43,
    zenith: '#1c2848',
    horizon: '#87614c',
    air: '#c9a9a0',
    fill: '#6f7fb0',
    bounce: '#4a3f3a',
    exposure: 4.0,
  },
  {
    phase: 0.33,
    sunElevationDeg: 28,
    key: '#ffe2b8',
    keyIntensity: 0.76,
    zenith: '#1f406b',
    horizon: '#687783',
    air: '#b5cde0',
    fill: '#8fb2dc',
    bounce: '#5a5a48',
    exposure: 3.65,
  },
  {
    phase: 0.50,
    sunElevationDeg: 62,
    key: '#fff4dc',
    keyIntensity: 0.95,
    zenith: '#163b6c',
    horizon: '#5d7283',
    air: '#a8c6e0',
    fill: '#9cc0ea',
    bounce: '#6a6a4e',
    exposure: 3.65,
  },
  {
    phase: 0.70,
    sunElevationDeg: 16,
    key: '#ffc070',
    keyIntensity: 0.81,
    zenith: '#1c315b',
    horizon: '#896f4a',
    air: '#e2b890',
    fill: '#7f8fc4',
    bounce: '#5c4a38',
    exposure: 3.85,
  },
  {
    phase: 0.77,
    sunElevationDeg: 2,
    key: '#ff8a5c',
    keyIntensity: 0.38,
    zenith: '#14183b',
    horizon: '#864b38',
    air: '#a8788a',
    fill: '#5a5c9c',
    bounce: '#3a2f38',
    exposure: 4.2,
  },
];

// Gain on the grass weight of the ground shader: the painted meadow albedo is dark (about 0.05
// linear), so it is lifted here instead of through a global exposure that also lifts every other region.
export const GROUND_GRASS_GAIN = 1.0;

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
export const HORIZON_APRON = { inner: 130, outer: 240 };
export const CAMERA_LIMITS = { pitchMin: 0.12, pitchMax: 1.15, distanceMin: 3.6, distanceMax: 26 };
export const WALK_BOUND = 118;
export const SHADOW_SUN_STEP_DEG = 0.5;
export const SHADOW_BIAS = -0.0004;
export const SHADOW_NORMAL_BIAS = 0.08;

// Empty tables populated by later slices
export const REGION_LOOK: unknown[] = [];
export const WEATHER: unknown[] = [];
export const FLORA_RULES: unknown[] = [];
export const KIT_PIECES: unknown[] = [];
export const EMITTERS: unknown[] = [];
