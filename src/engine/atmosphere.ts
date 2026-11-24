import * as THREE from 'three';
import type { DayFrame } from '../state/dayCycle';
import { GFX_TIERS, REGION_LOOK, type QualityTier } from '../data/look';
import { WORLD_REGIONS } from '../data/catalog';
import { player } from './context';

export const COLOR_FOOTER = `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;

export const AIR = {
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uKeyColor: { value: new THREE.Color(0xffffff) },
  uAirColor: { value: new THREE.Color(0xffffff) },
  uAirSunColor: { value: new THREE.Color(0xffffff) },
  uZenith: { value: new THREE.Color(0xffffff) },
  uHorizon: { value: new THREE.Color(0xffffff) },
  uFill: { value: new THREE.Color(0xffffff) },
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector2(0.6, 0.25) },
  uFogDensity: { value: 0.0028 },
  uFogHeightFalloff: { value: 0 },
  uFogBase: { value: 0 },
  uRegionTint: { value: new THREE.Color(0xffffff) },
};

// Design 5.4: densest below 2 units above the water plane (-0.34), halving every 9 units up.
const FOG_BASE = -0.34 + 2;
const FOG_HEIGHT_FALLOFF = Math.LN2 / 9;

/**
 * The air (design 6.3), applied to linear radiance before tone mapping. With uFogHeightFalloff 0 and
 * uAirSunColor equal to uAirColor it is plain exponential-squared fog. GLSL twin of `fogFactor` (dayCycle.ts).
 * `cameraPosition` comes from three's fragment prefix (every non-raw material).
 */
export const AIR_GLSL = `
uniform vec3 uSunDir;
uniform vec3 uAirColor;
uniform vec3 uAirSunColor;
uniform float uFogDensity;
uniform float uFogHeightFalloff;
uniform float uFogBase;
uniform vec2 uWind;
uniform float uTime;

vec3 applyAir(vec3 color, vec3 worldPos) {
  vec3 toFrag = worldPos - cameraPosition;
  float dist = length(toFrag);
  float fd = uFogDensity * dist;
  float fog = (1.0 - exp(-fd * fd)) * exp(-uFogHeightFalloff * max(worldPos.y - uFogBase, 0.0));
  float lean = pow(max(dot(toFrag / max(dist, 1e-4), normalize(uSunDir)), 0.0), 8.0);
  return mix(color, mix(uAirColor, uAirSunColor, lean), fog);
}

#ifdef CLOUD_SHADOW
float airHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float airNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(airHash(i), airHash(i + vec2(1.0, 0.0)), u.x),
             mix(airHash(i + vec2(0.0, 1.0)), airHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float cloudShade(vec2 xz) {
  vec2 p = (xz + uWind * uTime) * 0.018;
  float n = airNoise(p) * 0.65 + airNoise(p * 2.3 + 17.0) * 0.35;
  return mix(1.0, 0.55, smoothstep(0.55, 0.7, n));
}
#endif
`;

const AIR_VERTEX = `#include <project_vertex>
vec4 airWorld = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  airWorld = batchingMatrix * airWorld;
#endif
#ifdef USE_INSTANCING
  airWorld = instanceMatrix * airWorld;
#endif
vAirWorld = ( modelMatrix * airWorld ).xyz;`;

const attached = new Set<THREE.Material>();
let airTier: QualityTier = 'balanced';

function applyTierDefines(material: THREE.Material): void {
  const defines = (material.defines ??= {});
  if (GFX_TIERS[airTier].cloudShadows) defines.CLOUD_SHADOW = '';
  else delete defines.CLOUD_SHADOW;
}

/**
 * Chains the air onto a three material (design 6.3): shared AIR uniforms, a world-position
 * varying, `fog_pars_fragment` replaced and `fog_fragment` removed, and `applyAir` on
 * `outgoingLight` before `opaque_fragment`. Appends `|air` to the program cache key.
 */
export function attachAtmosphere(material: THREE.Material): void {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    Object.assign(shader.uniforms, AIR);
    shader.vertexShader = 'varying vec3 vAirWorld;\n' + shader.vertexShader.replace('#include <project_vertex>', AIR_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <fog_pars_fragment>', `varying vec3 vAirWorld;\n${AIR_GLSL}`)
      .replace('#include <fog_fragment>', '')
      .replace('#include <opaque_fragment>', `outgoingLight = applyAir(outgoingLight, vAirWorld);
#include <opaque_fragment>`);
  };
  const previousKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${previousKey()}|air`;
  applyTierDefines(material);
  attached.add(material);
  material.addEventListener('dispose', () => attached.delete(material));
}

/** The air's tier: the CLOUD_SHADOW define on every attached material, and the uniform terms `updateAir` writes. */
export function setAirTier(tier: QualityTier): void {
  if (tier === airTier) return;
  airTier = tier;
  for (const material of attached) {
    applyTierDefines(material);
    material.needsUpdate = true;
  }
}

const regionTint = new THREE.Color();
const tintColor = new THREE.Color();

/**
 * Each region tints the air by at most its weight (design 5.4, 5.5), blended by inverse-square distance
 * to the region centres. The factor keeps the air's luminance: it mixes 1 toward the tint over its luminance.
 */
function blendRegionTint(x: number, z: number, out: THREE.Color): THREE.Color {
  let total = 0;
  out.setRGB(0, 0, 0);
  WORLD_REGIONS.forEach((region, i) => {
    const look = REGION_LOOK[i];
    const w = 1 / ((x - region.x) ** 2 + (z - region.z) ** 2 + 1);
    tintColor.set(look.airTint);
    tintColor.multiplyScalar(1 / (0.2126 * tintColor.r + 0.7152 * tintColor.g + 0.0722 * tintColor.b));
    out.r += w * (1 + (tintColor.r - 1) * look.airWeight);
    out.g += w * (1 + (tintColor.g - 1) * look.airWeight);
    out.b += w * (1 + (tintColor.b - 1) * look.airWeight);
    total += w;
  });
  return out.multiplyScalar(1 / total);
}

export function updateAir(frame: DayFrame, dt: number): void {
  const full = GFX_TIERS[airTier].airHeightSunLeanRegionTint;
  AIR.uSunDir.value.set(frame.sunDir[0], frame.sunDir[1], frame.sunDir[2]);
  AIR.uKeyColor.value.setRGB(frame.key[0], frame.key[1], frame.key[2]);
  if (full) blendRegionTint(player.pos.x, player.pos.z, regionTint);
  else regionTint.setRGB(1, 1, 1);
  AIR.uRegionTint.value.copy(regionTint);
  AIR.uAirColor.value.setRGB(frame.air[0], frame.air[1], frame.air[2]).multiply(regionTint);
  // Design 5.4: toward the key the air takes the horizon colour; the plain tier has no lean
  if (full) AIR.uAirSunColor.value.setRGB(frame.horizon[0], frame.horizon[1], frame.horizon[2]).multiply(regionTint);
  else AIR.uAirSunColor.value.copy(AIR.uAirColor.value);
  AIR.uFogHeightFalloff.value = full ? FOG_HEIGHT_FALLOFF : 0;
  AIR.uFogBase.value = FOG_BASE;
  AIR.uZenith.value.setRGB(frame.zenith[0], frame.zenith[1], frame.zenith[2]);
  AIR.uHorizon.value.setRGB(frame.horizon[0], frame.horizon[1], frame.horizon[2]);
  AIR.uFill.value.setRGB(frame.fill[0], frame.fill[1], frame.fill[2]);
  AIR.uTime.value += dt;
}
