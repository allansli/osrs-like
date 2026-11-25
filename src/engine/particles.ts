import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GFX_TIERS, WEATHER, type QualityTier, type WeatherDef } from '../data/look';
import { WORLD_REGIONS } from '../data/world';
import { player } from './context';
import { AIR } from './atmosphere';
import { isPlainMode } from './post';
import { weatherAt } from '../state/weather';
import { currentDayIndexValue, currentPhaseValue } from './lighting';

/** Seeded PRNG (Mulberry32). */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hexToLinearRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return [toLinear(r), toLinear(g), toLinear(b)];
}

function buildDiamondGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array([
    0, 0.09, 0,
    0.06, 0, 0,
    0, -0.09, 0,
    -0.06, 0, 0,
  ]);
  const norm = new Float32Array([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ]);
  const shape = new Float32Array([0, 0, 0, 0]);
  const idx = [0, 1, 2, 0, 2, 3];
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  geo.setAttribute('aShapeId', new THREE.BufferAttribute(shape, 1));
  geo.setIndex(idx);
  return geo;
}

function buildLeafGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array([
    0, 0.12, 0,
    0.06, 0.03, 0,
    0, -0.07, 0,
    -0.04, 0.04, 0,
  ]);
  const norm = new Float32Array([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ]);
  const shape = new Float32Array([1, 1, 1, 1]);
  const idx = [0, 1, 2, 0, 2, 3];
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  geo.setAttribute('aShapeId', new THREE.BufferAttribute(shape, 1));
  geo.setIndex(idx);
  return geo;
}

function buildSliverGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array([
    -0.015, 0.30, 0,
    0.015, 0.30, 0,
    0.015, -0.30, 0,
    -0.015, -0.30, 0,
  ]);
  const norm = new Float32Array([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ]);
  const shape = new Float32Array([2, 2, 2, 2]);
  const idx = [0, 1, 2, 0, 2, 3];
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  geo.setAttribute('aShapeId', new THREE.BufferAttribute(shape, 1));
  geo.setIndex(idx);
  return geo;
}

function buildFlakeGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array([
    -0.05, 0.05, 0,
    0.05, 0.05, 0,
    0.05, -0.05, 0,
    -0.05, -0.05, 0,
  ]);
  const norm = new Float32Array([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ]);
  const shape = new Float32Array([3, 3, 3, 3]);
  const idx = [0, 1, 2, 0, 2, 3];
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  geo.setAttribute('aShapeId', new THREE.BufferAttribute(shape, 1));
  geo.setIndex(idx);
  return geo;
}

const MOTES_VERTEX_SHADER = `
attribute float aShapeId;
attribute float aInstanceShape;
attribute vec4 aSeed;
attribute vec2 aSpeed;
attribute float aScale;
attribute float aMoteKind;
attribute float aSpinSpeed;

uniform vec3 uBoxSize;
uniform vec3 uBoxHalf;
uniform vec3 uCameraPos;
uniform float uTime;
uniform vec2 uWind;
uniform float uFallSpeed;
uniform float uWobble;
uniform float uOpacity;
uniform float uWindMultiplier;
uniform vec3 uMoteColor0;
uniform vec3 uMoteColor1;

varying vec3 vColor;
varying float vAlpha;

void main() {
  if (abs(aShapeId - aInstanceShape) > 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec3 baseOffset = aSeed.xyz * uBoxSize;
  vec3 move = vec3(0.0);
  move.xz += uWind * (uTime * aSpeed.x * uWindMultiplier);
  move.y -= uFallSpeed * aSpeed.y * uTime;
  move.x += sin(uTime * 1.5 + aSeed.w * 6.28) * uWobble;
  move.z += cos(uTime * 1.3 + aSeed.w * 6.28) * uWobble;
  move.y += sin(uTime * 2.1 + aSeed.w * 6.28) * (uWobble * 0.5);

  vec3 wrapped = mod(mod(baseOffset + move, uBoxSize) + uBoxSize, uBoxSize);
  vec3 relPos = wrapped - uBoxHalf;
  vec3 centerPos = uCameraPos + relPos;

  vec3 faceDist = abs(relPos) / uBoxHalf;
  float fade = smoothstep(1.0, 0.7, faceDist.x) *
               smoothstep(1.0, 0.7, faceDist.y) *
               smoothstep(1.0, 0.7, faceDist.z);
  vAlpha = fade * uOpacity;

  float spin = uTime * aSpinSpeed + aSeed.y * 6.28;
  float c = cos(spin);
  float s = sin(spin);
  vec2 rotated = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * aScale;

  vec4 viewCenter = viewMatrix * vec4(centerPos, 1.0);
  viewCenter.xy += rotated;
  gl_Position = projectionMatrix * viewCenter;

  vColor = mix(uMoteColor0, uMoteColor1, aMoteKind);
}
`;

const FALL_VERTEX_SHADER = `
attribute float aShapeId;
attribute float aInstanceShape;
attribute vec4 aSeed;
attribute vec2 aSpeed;
attribute float aScale;

uniform vec3 uBoxSize;
uniform vec3 uBoxHalf;
uniform vec3 uCameraPos;
uniform float uTime;
uniform vec2 uWind;
uniform float uFallSpeed;
uniform float uWobble;
uniform float uOpacity;
uniform float uWindMultiplier;
uniform vec3 uFallColor;

varying vec3 vColor;
varying float vAlpha;

void main() {
  if (abs(aShapeId - aInstanceShape) > 0.5) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec3 baseOffset = aSeed.xyz * uBoxSize;
  vec3 move = vec3(0.0);
  move.xz += uWind * (uTime * aSpeed.x * uWindMultiplier);
  move.y -= uFallSpeed * aSpeed.y * uTime;
  move.x += sin(uTime * 1.5 + aSeed.w * 6.28) * uWobble;
  move.z += cos(uTime * 1.3 + aSeed.w * 6.28) * uWobble;

  vec3 wrapped = mod(mod(baseOffset + move, uBoxSize) + uBoxSize, uBoxSize);
  vec3 relPos = wrapped - uBoxHalf;
  vec3 centerPos = uCameraPos + relPos;

  vec3 faceDist = abs(relPos) / uBoxHalf;
  float fade = smoothstep(1.0, 0.7, faceDist.x) *
               smoothstep(1.0, 0.7, faceDist.y) *
               smoothstep(1.0, 0.7, faceDist.z);
  vAlpha = fade * uOpacity;

  vec4 viewCenter = viewMatrix * vec4(centerPos, 1.0);
  vec2 viewWind = (viewMatrix * vec4(uWind.x, 0.0, uWind.y, 0.0)).xy * uWindMultiplier;
  vec2 vert = position.xy * aScale;
  vert.x += vert.y * viewWind.x * 0.35;
  viewCenter.xy += vert;
  gl_Position = projectionMatrix * viewCenter;

  vColor = uFallColor;
}
`;

const PARTICLE_FRAGMENT_SHADER = `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;

void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`;

let weatherOverride: string | null = null;

export function setWeatherOverride(id: string | null): void {
  if (!id || id === 'auto') {
    weatherOverride = null;
  } else {
    const match = WEATHER.find((w) => w.id === id) || WEATHER.find((w) => w.id.includes(id));
    weatherOverride = match ? match.id : id;
  }
}

export function getWeatherOverride(): string | null {
  return weatherOverride;
}

export interface ResolvedWeather {
  id: string;
  blend: number;
  curr: WeatherDef;
  prev: WeatherDef;
  keyScale: number;
  fogScale: number;
}

export function getWeatherState(dayIndex: number, phase: number): ResolvedWeather {
  if (weatherOverride) {
    const def = WEATHER.find((w) => w.id === weatherOverride) ?? WEATHER[0];
    return {
      id: def.id,
      blend: 1.0,
      curr: def,
      prev: def,
      keyScale: def.keyScale,
      fogScale: def.fogScale,
    };
  }

  const weights: Record<string, number> = {};
  for (const reg of WORLD_REGIONS) {
    weights[reg.id] = 1 / ((player.pos.x - reg.x) ** 2 + (player.pos.z - reg.z) ** 2 + 1);
  }
  const state = weatherAt(dayIndex, phase, weights);
  const curr = WEATHER.find((w) => w.id === state.id) ?? WEATHER[0];

  let maxW = -1;
  let heaviest = WORLD_REGIONS[0].id;
  for (const [r, wt] of Object.entries(weights)) {
    if (wt > maxW) {
      maxW = wt;
      heaviest = r;
    }
  }

  const allowed = WEATHER.filter((w) => w.regions.includes(heaviest));
  const bucket = Math.floor(phase * 10);
  const prevBucket = bucket === 0 ? 9 : bucket - 1;
  const prevDay = bucket === 0 ? dayIndex - 1 : dayIndex;

  let x = (prevDay * 10 + prevBucket) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 1 | x);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  const prevH = (x ^ (x >>> 14)) >>> 0;
  const prevDef = allowed[prevH % allowed.length] ?? curr;

  const blend = state.blend;
  const keyScale = curr.id === prevDef.id ? curr.keyScale : prevDef.keyScale * (1 - blend) + curr.keyScale * blend;
  const fogScale = curr.id === prevDef.id ? curr.fogScale : prevDef.fogScale * (1 - blend) + curr.fogScale * blend;

  return {
    id: state.id,
    blend,
    curr,
    prev: prevDef,
    keyScale,
    fogScale,
  };
}

let currentTier: QualityTier = 'balanced';
let motesMesh: THREE.InstancedMesh | null = null;
let fallMesh: THREE.InstancedMesh | null = null;
let motesMaterial: THREE.ShaderMaterial | null = null;
let fallMaterial: THREE.ShaderMaterial | null = null;

export function setParticlesTier(tier: QualityTier): void {
  currentTier = tier;
  if (!motesMesh || !fallMesh) return;

  const motesCount = GFX_TIERS[tier].motes;
  motesMesh.count = motesCount;
  motesMesh.visible = motesCount > 0 && !isPlainMode();

  const redMotion = prefersReducedMotion();
  const baseFall = GFX_TIERS[tier].weatherParticles;
  const fallCount = redMotion ? Math.floor(baseFall / 2) : baseFall;
  fallMesh.count = fallCount;
  fallMesh.visible = fallCount > 0 && !isPlainMode();
}

export function initParticles(scene: THREE.Scene, tier: QualityTier): void {
  currentTier = tier;
  const diamond = buildDiamondGeometry();
  const leaf = buildLeafGeometry();
  const sliver = buildSliverGeometry();
  const flake = buildFlakeGeometry();
  const baseGeo = mergeGeometries([diamond, leaf, sliver, flake]);

  const maxMotes = GFX_TIERS.ultra.motes;
  const maxFall = GFX_TIERS.ultra.weatherParticles;

  const rng = makeRng(0x73a7);

  const moteBox = new THREE.Vector3(36, 14, 36);
  const fallBox = new THREE.Vector3(44, 26, 44);

  motesMaterial = new THREE.ShaderMaterial({
    vertexShader: MOTES_VERTEX_SHADER,
    fragmentShader: PARTICLE_FRAGMENT_SHADER,
    uniforms: {
      uBoxSize: { value: moteBox },
      uBoxHalf: { value: moteBox.clone().multiplyScalar(0.5) },
      uCameraPos: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uWind: { value: new THREE.Vector2(0.6, 0.25) },
      uFallSpeed: { value: 0.4 },
      uWobble: { value: 0.6 },
      uOpacity: { value: 0.8 },
      uWindMultiplier: { value: 1.0 },
      uMoteColor0: { value: new THREE.Color(0xffffff) },
      uMoteColor1: { value: new THREE.Color(0xffffff) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });

  fallMaterial = new THREE.ShaderMaterial({
    vertexShader: FALL_VERTEX_SHADER,
    fragmentShader: PARTICLE_FRAGMENT_SHADER,
    uniforms: {
      uBoxSize: { value: fallBox },
      uBoxHalf: { value: fallBox.clone().multiplyScalar(0.5) },
      uCameraPos: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uWind: { value: new THREE.Vector2(0.6, 0.25) },
      uFallSpeed: { value: 16.0 },
      uWobble: { value: 0.15 },
      uOpacity: { value: 0.0 },
      uWindMultiplier: { value: 1.8 },
      uFallColor: { value: new THREE.Color(0xffffff) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
  });

  // Motes mesh setup
  const motesGeo = baseGeo.clone();
  const motesShapes = new Float32Array(maxMotes);
  const motesSeeds = new Float32Array(maxMotes * 4);
  const motesSpeeds = new Float32Array(maxMotes * 2);
  const motesScales = new Float32Array(maxMotes);
  const motesKinds = new Float32Array(maxMotes);
  const motesSpins = new Float32Array(maxMotes);

  for (let i = 0; i < maxMotes; i++) {
    const r = rng();
    motesShapes[i] = r < 0.35 ? 0 : (r < 0.70 ? 1 : 3);
    motesSeeds[i * 4 + 0] = rng();
    motesSeeds[i * 4 + 1] = rng();
    motesSeeds[i * 4 + 2] = rng();
    motesSeeds[i * 4 + 3] = rng();
    motesSpeeds[i * 2 + 0] = rng() * 0.4 + 0.8;
    motesSpeeds[i * 2 + 1] = rng() * 0.3 + 0.8;
    motesScales[i] = rng() * 0.5 + 0.75;
    motesKinds[i] = i % 2 === 0 ? 0.0 : 1.0;
    motesSpins[i] = (rng() - 0.5) * 3.0;
  }

  motesGeo.setAttribute('aInstanceShape', new THREE.InstancedBufferAttribute(motesShapes, 1));
  motesGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(motesSeeds, 4));
  motesGeo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(motesSpeeds, 2));
  motesGeo.setAttribute('aScale', new THREE.InstancedBufferAttribute(motesScales, 1));
  motesGeo.setAttribute('aMoteKind', new THREE.InstancedBufferAttribute(motesKinds, 1));
  motesGeo.setAttribute('aSpinSpeed', new THREE.InstancedBufferAttribute(motesSpins, 1));

  motesMesh = new THREE.InstancedMesh(motesGeo, motesMaterial, maxMotes);
  motesMesh.frustumCulled = false;

  // Fall mesh setup
  const fallGeo = baseGeo.clone();
  const fallShapes = new Float32Array(maxFall);
  const fallSeeds = new Float32Array(maxFall * 4);
  const fallSpeeds = new Float32Array(maxFall * 2);
  const fallScales = new Float32Array(maxFall);

  for (let i = 0; i < maxFall; i++) {
    fallShapes[i] = rng() < 0.65 ? 2 : 3;
    fallSeeds[i * 4 + 0] = rng();
    fallSeeds[i * 4 + 1] = rng();
    fallSeeds[i * 4 + 2] = rng();
    fallSeeds[i * 4 + 3] = rng();
    fallSpeeds[i * 2 + 0] = rng() * 0.3 + 0.85;
    fallSpeeds[i * 2 + 1] = rng() * 0.4 + 0.8;
    fallScales[i] = rng() * 0.4 + 0.8;
  }

  fallGeo.setAttribute('aInstanceShape', new THREE.InstancedBufferAttribute(fallShapes, 1));
  fallGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(fallSeeds, 4));
  fallGeo.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(fallSpeeds, 2));
  fallGeo.setAttribute('aScale', new THREE.InstancedBufferAttribute(fallScales, 1));

  fallMesh = new THREE.InstancedMesh(fallGeo, fallMaterial, maxFall);
  fallMesh.frustumCulled = false;

  const identity = new THREE.Matrix4();
  for (let i = 0; i < maxMotes; i++) motesMesh.setMatrixAt(i, identity);
  motesMesh.instanceMatrix.needsUpdate = true;

  for (let i = 0; i < maxFall; i++) fallMesh.setMatrixAt(i, identity);
  fallMesh.instanceMatrix.needsUpdate = true;

  scene.add(motesMesh);
  scene.add(fallMesh);

  setParticlesTier(tier);
}

export function updateParticles(dt: number, camera: THREE.Camera): void {
  if (!motesMesh || !fallMesh || !motesMaterial || !fallMaterial) return;

  motesMaterial.uniforms.uTime.value += dt;
  fallMaterial.uniforms.uTime.value += dt;

  motesMaterial.uniforms.uCameraPos.value.copy(camera.position);
  fallMaterial.uniforms.uCameraPos.value.copy(camera.position);

  const redMotion = prefersReducedMotion();
  const windScale = redMotion ? 1 / 3 : 1;
  AIR.uWind.value.set(0.6 * windScale, 0.25 * windScale);
  motesMaterial.uniforms.uWind.value.copy(AIR.uWind.value);
  fallMaterial.uniforms.uWind.value.copy(AIR.uWind.value);

  const baseFall = GFX_TIERS[currentTier].weatherParticles;
  const targetFallCount = redMotion ? Math.floor(baseFall / 2) : baseFall;
  if (fallMesh.count !== targetFallCount) {
    fallMesh.count = targetFallCount;
  }

  const weather = getWeatherState(currentDayIndexValue(), currentPhaseValue());

  // Motes colors
  const curr = weather.curr;
  const prev = weather.prev;
  const blend = weather.blend;

  const currM0 = curr.motes[0];
  const currM1 = curr.motes.length > 1 ? curr.motes[1] : curr.motes[0];
  const prevM0 = prev.motes[0];
  const prevM1 = prev.motes.length > 1 ? prev.motes[1] : prev.motes[0];

  const linCurr0 = hexToLinearRgb(currM0.color);
  const linCurr1 = hexToLinearRgb(currM1.color);
  const linPrev0 = hexToLinearRgb(prevM0.color);
  const linPrev1 = hexToLinearRgb(prevM1.color);

  const r0 = (linPrev0[0] * prevM0.intensity) * (1 - blend) + (linCurr0[0] * currM0.intensity) * blend;
  const g0 = (linPrev0[1] * prevM0.intensity) * (1 - blend) + (linCurr0[1] * currM0.intensity) * blend;
  const b0 = (linPrev0[2] * prevM0.intensity) * (1 - blend) + (linCurr0[2] * currM0.intensity) * blend;

  const r1 = (linPrev1[0] * prevM1.intensity) * (1 - blend) + (linCurr1[0] * currM1.intensity) * blend;
  const g1 = (linPrev1[1] * prevM1.intensity) * (1 - blend) + (linCurr1[1] * currM1.intensity) * blend;
  const b1 = (linPrev1[2] * prevM1.intensity) * (1 - blend) + (linCurr1[2] * currM1.intensity) * blend;

  motesMaterial.uniforms.uMoteColor0.value.setRGB(r0, g0, b0);
  motesMaterial.uniforms.uMoteColor1.value.setRGB(r1, g1, b1);

  // Fall uniforms
  let fallOpacity = 0;
  let fallR = 0, fallG = 0, fallB = 0;
  let fallSpeed = 16.0;

  if (curr.fall && prev.fall) {
    fallOpacity = 1;
    const cCurr = hexToLinearRgb(curr.fall.color);
    const cPrev = hexToLinearRgb(prev.fall.color);
    fallR = cPrev[0] * (1 - blend) + cCurr[0] * blend;
    fallG = cPrev[1] * (1 - blend) + cCurr[1] * blend;
    fallB = cPrev[2] * (1 - blend) + cCurr[2] * blend;
  } else if (curr.fall && !prev.fall) {
    fallOpacity = blend;
    const cCurr = hexToLinearRgb(curr.fall.color);
    fallR = cCurr[0]; fallG = cCurr[1]; fallB = cCurr[2];
  } else if (!curr.fall && prev.fall) {
    fallOpacity = 1 - blend;
    const cPrev = hexToLinearRgb(prev.fall.color);
    fallR = cPrev[0]; fallG = cPrev[1]; fallB = cPrev[2];
  }

  if (weather.id === 'rain') {
    fallSpeed = 22.0;
  } else if (weather.id === 'sand_haze') {
    fallSpeed = 5.0;
  } else if (weather.id === 'ash_fall') {
    fallSpeed = 7.0;
  }

  fallMaterial.uniforms.uFallColor.value.setRGB(fallR, fallG, fallB);
  fallMaterial.uniforms.uOpacity.value = fallOpacity * 0.85;
  fallMaterial.uniforms.uFallSpeed.value = fallSpeed;

  const motesCount = GFX_TIERS[currentTier].motes;
  motesMesh.visible = motesCount > 0 && !isPlainMode();

  fallMesh.visible = targetFallCount > 0 && fallOpacity > 0.01 && !isPlainMode();
}
