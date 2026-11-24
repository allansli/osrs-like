import * as THREE from 'three';
import { G } from './context';
import { GFX_TIERS, KIT_PIECES, type KitPieceId, type QualityTier } from '../data/look';
import { WOODS_TREES } from '../data/woodsTrees';
import { WORLD_REGIONS } from '../data/world';
import { PATHS, POIS } from '../data/worldMap';
import { buildScatter, type ScatterResult } from '../state/scatter';
import { hitsCastleWall, inBasinWater, isDeepWater, nearestOnPolyline } from '../state/collision';
import { getTerrainHeight, slopeAt, TERRAIN_SIZE } from '../state/terrain';
import { facetMaterial } from './materials';
import { isPlainMode } from './post';
import { buildCarpetTuft, buildKitPiece, CARPET_VARIANTS, makeRng } from './floraKit';

export const FLORA_SEED = 20261114;

const ALL_PIECES: KitPieceId[] = [
  'boulder_s',
  'boulder_m',
  'boulder_l',
  'bush_a',
  'bush_b',
  'fern',
  'reed',
  'log',
  'snag',
  'sapling',
  'mushrooms',
  'backdrop_tree_a',
  'backdrop_tree_b',
  'crag_a',
  'crag_b',
];

let floraMeshes: THREE.InstancedMesh[] = [];
let woodsTreeMeshes: [THREE.InstancedMesh, THREE.InstancedMesh] | null = null;

export function getFloraMeshes(): THREE.InstancedMesh[] {
  return floraMeshes;
}

export function getWoodsTreeMeshes(): [THREE.InstancedMesh, THREE.InstancedMesh] | null {
  return woodsTreeMeshes;
}

export function clearFlora(): void {
  for (const mesh of floraMeshes) {
    G.scene.remove(mesh);
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    } else {
      mesh.material.dispose();
    }
  }
  floraMeshes = [];
  woodsTreeMeshes = null;
}

export function buildFlora(tier: QualityTier): THREE.InstancedMesh[] {
  clearFlora();

  const dummy = new THREE.Object3D();
  const scatterResult: ScatterResult = buildScatter(FLORA_SEED, tier);

  for (let pIdx = 0; pIdx < ALL_PIECES.length; pIdx++) {
    const id = ALL_PIECES[pIdx];
    const instances = scatterResult[id];

    const geoRng = makeRng(FLORA_SEED + pIdx);
    const geo = buildKitPiece(id, geoRng);
    const mat = facetMaterial({ shade: 'cut', vertexColors: true, footHeight: 0.6 });
    const count = instances.length;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = KIT_PIECES[id].castShadow;
    mesh.receiveShadow = true;
    mesh.userData = { kitPieceId: id };

    for (let i = 0; i < count; i++) {
      const inst = instances[i];
      const y = getTerrainHeight(inst.x, inst.z);
      dummy.position.set(inst.x, y, inst.z);
      dummy.rotation.set(0, inst.rot, 0);
      dummy.scale.set(inst.scale, inst.scale, inst.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    G.scene.add(mesh);
    floraMeshes.push(mesh);
  }

  // Woods trees: built on every tier and never thinned, because they are walkability, not decoration.
  const rowsA: Array<{ x: number; y: number; z: number; rotY: number; scale: number }> = [];
  const rowsB: Array<{ x: number; y: number; z: number; rotY: number; scale: number }> = [];

  for (let idx = 0; idx < WOODS_TREES.length; idx++) {
    const [i, j] = WOODS_TREES[idx];
    const x = -118 + i + 0.5;
    const z = -118 + j + 0.5;
    const y = getTerrainHeight(x, z);

    // Variant, small rotation and scale chosen deterministically from cell indices
    const isB = ((i * 7 + j * 13) & 1) === 1;
    const rotY = ((i * 37 + j * 73) % 628) / 100;
    const scale = 0.92 + (((i * 17 + j * 29) % 100) / 100) * 0.16;

    if (isB) {
      rowsB.push({ x, y, z, rotY, scale });
    } else {
      rowsA.push({ x, y, z, rotY, scale });
    }
  }

  const geoA = buildKitPiece('woods_tree_a', makeRng(FLORA_SEED + 101));
  const matA = facetMaterial({ shade: 'cut', vertexColors: true, footHeight: 0.6 });
  const meshA = new THREE.InstancedMesh(geoA, matA, rowsA.length);
  meshA.castShadow = true;
  meshA.receiveShadow = true;
  meshA.userData = { kitPieceId: 'woods_tree_a', isWoodsTree: true };
  for (let k = 0; k < rowsA.length; k++) {
    const r = rowsA[k];
    dummy.position.set(r.x, r.y, r.z);
    dummy.rotation.set(0, r.rotY, 0);
    dummy.scale.set(r.scale, r.scale, r.scale);
    dummy.updateMatrix();
    meshA.setMatrixAt(k, dummy.matrix);
  }
  meshA.instanceMatrix.needsUpdate = true;
  G.scene.add(meshA);
  floraMeshes.push(meshA);

  const geoB = buildKitPiece('woods_tree_b', makeRng(FLORA_SEED + 102));
  const matB = facetMaterial({ shade: 'cut', vertexColors: true, footHeight: 0.6 });
  const meshB = new THREE.InstancedMesh(geoB, matB, rowsB.length);
  meshB.castShadow = true;
  meshB.receiveShadow = true;
  meshB.userData = { kitPieceId: 'woods_tree_b', isWoodsTree: true };
  for (let k = 0; k < rowsB.length; k++) {
    const r = rowsB[k];
    dummy.position.set(r.x, r.y, r.z);
    dummy.rotation.set(0, r.rotY, 0);
    dummy.scale.set(r.scale, r.scale, r.scale);
    dummy.updateMatrix();
    meshB.setMatrixAt(k, dummy.matrix);
  }
  meshB.instanceMatrix.needsUpdate = true;
  G.scene.add(meshB);
  floraMeshes.push(meshB);

  woodsTreeMeshes = [meshA, meshB];

  buildCarpet(tier);
  return floraMeshes;
}

/** Varrock's paved plaza: dirt in the ground colour (worldMesh.getBiomeColor) and bare of carpet. */
export const PAVED_PLAZA = { x: 78, z: -20, radius: 18 };

// Design 6.7: the ground field, 257 x 257 texels over the 260-unit terrain.
export const GROUND_FIELD_SIZE = 257;
const FIELD_STEP = TERRAIN_SIZE / (GROUND_FIELD_SIZE - 1);
const CRAG_SLOPE = 0.55; // the Stage 2 crag threshold of getBiomeColor
const BANK = -0.05; // below this the ground is the river bed or a pond bank (dirt in getBiomeColor); region cores sit at 0
const VERGE_WIDTH = 2;
const VERGE_DENSITY = 1.5;
const POI_MIN_CLEAR = 2; // a POI without a pad (Reedglass Tarn's marker) still keeps its centre bare

// Carpet family per region (field B): 0 meadow, 1/3 woods, 2/3 dry, 1 ember. Regions not named are meadow.
const REGION_FAMILY: Record<string, number> = { woods: 1 / 3, desert: 2 / 3, wilderness: 1 };

/**
 * Carpet density at a point (field G): 0 inside a path's half-width, a POI pad, water, the castle walls,
 * slopes above the crag threshold and the paved plaza; 1.5 on the 2-unit path verge; 1 elsewhere.
 */
function carpetDensity(x: number, z: number, h: number): number {
  if (h < BANK || isDeepWater(x, z) || inBasinWater(x, z) || hitsCastleWall(x, z)) return 0;
  if (Math.hypot(x - PAVED_PLAZA.x, z - PAVED_PLAZA.z) < PAVED_PLAZA.radius) return 0;
  for (const poi of POIS) {
    if (Math.hypot(x - poi.x, z - poi.z) < Math.max(poi.padRadius, POI_MIN_CLEAR)) return 0;
  }
  let verge = false;
  for (const p of PATHS) {
    const d = nearestOnPolyline(p.points, x, z).d;
    if (d <= p.halfWidth) return 0;
    if (d <= p.halfWidth + VERGE_WIDTH) verge = true;
  }
  if (slopeAt(x, z) > CRAG_SLOPE) return 0;
  return verge ? VERGE_DENSITY : 1;
}

/**
 * The ground field (design 6.7): R height, G carpet density, B carpet family, A how far into its
 * region a texel lies (0 at the rim, 1 from three quarters of the radius in). Half-float, linear filtered.
 * Texel (i, j) samples x = -130 + i * step, z = -130 + j * step.
 */
export function buildGroundField(): THREE.DataTexture {
  const n = GROUND_FIELD_SIZE;
  const data = new Uint16Array(n * n * 4);
  const half = TERRAIN_SIZE / 2;
  for (let j = 0; j < n; j++) {
    const z = -half + j * FIELD_STEP;
    for (let i = 0; i < n; i++) {
      const x = -half + i * FIELD_STEP;
      const h = getTerrainHeight(x, z);
      let family = 0;
      let blend = 0;
      for (const reg of WORLD_REGIONS) {
        const d = Math.hypot(x - reg.x, z - reg.z);
        const w = 1 - THREE.MathUtils.smoothstep(d, 0.75 * reg.radius, reg.radius);
        if (w > blend) {
          blend = w;
          family = REGION_FAMILY[reg.id] ?? 0;
        }
      }
      const o = (j * n + i) * 4;
      data[o] = THREE.DataUtils.toHalfFloat(h);
      data[o + 1] = THREE.DataUtils.toHalfFloat(carpetDensity(x, z, h));
      data[o + 2] = THREE.DataUtils.toHalfFloat(family);
      data[o + 3] = THREE.DataUtils.toHalfFloat(blend);
    }
  }
  const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// Presence weight of each variant per family (meadow, woods, dry, ember); tuned at GR7.
const CARPET_WEIGHTS: Record<(typeof CARPET_VARIANTS)[number], [number, number, number, number]> = {
  tuft: [1, 0.8, 0.3, 0],
  flower: [0.35, 0.1, 0, 0],
  tussock: [0.25, 0.5, 1, 0.4],
  ember_grass: [0, 0, 0.1, 1],
};
const CARPET_SPACING = 0.5; // world units per carpet grid cell
const CARPET_SEED = FLORA_SEED + 200;

const carpetShared = {
  uGroundField: { value: null as THREE.DataTexture | null },
  uHeroXZ: { value: new THREE.Vector2() },
  uCarpetGrid: { value: 0 },
  uCarpetSpacing: { value: CARPET_SPACING },
  uCarpetRadius: { value: 0 },
};

const CARPET_PARS = `
uniform sampler2D uGroundField;
uniform vec2 uHeroXZ;
uniform float uCarpetGrid;
uniform float uCarpetSpacing;
uniform float uCarpetRadius;
uniform float uCarpetVariant;
uniform vec4 uCarpetWeights;
uniform vec2 uWind;
uniform float uTime;
float carpetHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float carpetNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(carpetHash(i), carpetHash(i + vec2(1.0, 0.0)), u.x),
             mix(carpetHash(i + vec2(0.0, 1.0)), carpetHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float carpetWeight(vec4 w, float family) {
  float f = clamp(family, 0.0, 1.0) * 3.0;
  float lo = floor(min(f, 2.0));
  float t = f - lo;
  return lo < 0.5 ? mix(w.x, w.y, t) : lo < 1.5 ? mix(w.y, w.z, t) : mix(w.z, w.w, t);
}
`;

/*
 * Instance k of variant v is grid cell k * 4 + v of a uCarpetGrid-square grid. Its world cell is the one
 * congruent to it nearest the hero, so a tuft stays put until it wraps to the far side, where it is faded out.
 */
const CARPET_VERTEX = `#include <begin_vertex>
{
  float k = float(gl_InstanceID) * 4.0 + uCarpetVariant;
  vec2 local = vec2(mod(k, uCarpetGrid), floor(k / uCarpetGrid));
  vec2 heroCell = floor(uHeroXZ / uCarpetSpacing);
  vec2 cell = local + uCarpetGrid * floor((heroCell - local) / uCarpetGrid + 0.5);
  vec2 xz = (cell + 0.15 + 0.7 * vec2(carpetHash(cell), carpetHash(cell + 17.31))) * uCarpetSpacing;
  vec2 fieldUv = (xz + ${(TERRAIN_SIZE / 2).toFixed(1)}) / ${TERRAIN_SIZE.toFixed(1)} * ${((GROUND_FIELD_SIZE - 1) / GROUND_FIELD_SIZE).toFixed(6)} + ${(0.5 / GROUND_FIELD_SIZE).toFixed(6)};
  vec4 field = texture2D(uGroundField, fieldUv);
  float weight = mix(uCarpetWeights.x, carpetWeight(uCarpetWeights, field.b), field.a);
  float present = step(carpetHash(cell + 41.7), field.g * weight) * step(k, uCarpetGrid * uCarpetGrid - 0.5);
  float edge = 1.0 - smoothstep(0.85 * uCarpetRadius, uCarpetRadius, length(xz - uHeroXZ));
  float size = present * edge * (0.7 + 0.3 * min(field.g, 1.5)) * (0.8 + 0.4 * carpetHash(cell + 7.9));
  float rot = carpetHash(cell + 3.3) * 6.2832;
  float cr = cos(rot);
  float sr = sin(rot);
  vec3 p = transformed * size;
  p.xz = vec2(cr * p.x - sr * p.z, sr * p.x + cr * p.z);
  float gust = carpetNoise((xz - uWind * uTime * 4.0) * 0.08);
  vec2 flutter = vec2(sin(uTime * 2.3 + xz.x * 0.7), cos(uTime * 1.9 + xz.y * 0.6)) * 0.08;
  p.xz += (uWind * (0.3 + 0.9 * gust) + flutter) * p.y * p.y * 2.0;
  transformed = vec3(xz.x + p.x, field.r - 0.03 + p.y, xz.y + p.z);
}`;

/**
 * The carpet's material (design 6.7): a round facet material with vertex colours, so it gets the banded
 * light, received shadows and the air like the ground, plus one link that places and bends each tuft.
 */
export function carpetMaterial(variant: number, field: THREE.DataTexture): THREE.MeshLambertMaterial {
  carpetShared.uGroundField.value = field;
  const mat = facetMaterial({ shade: 'round', vertexColors: true });
  const own = {
    uCarpetVariant: { value: variant },
    uCarpetWeights: { value: new THREE.Vector4(...CARPET_WEIGHTS[CARPET_VARIANTS[variant]]) },
  };
  const previous = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    previous.call(mat, shader, renderer);
    Object.assign(shader.uniforms, carpetShared, own);
    shader.vertexShader = CARPET_PARS + shader.vertexShader.replace('#include <begin_vertex>', CARPET_VERTEX);
  };
  const previousKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${previousKey()}|carpet`;
  return mat;
}

let groundField: THREE.DataTexture | null = null;
let carpetMeshes: THREE.InstancedMesh[] = [];
let carpetTufts = -1;

export function getCarpetMeshes(): THREE.InstancedMesh[] {
  return carpetMeshes;
}

function clearCarpet(): void {
  for (const mesh of carpetMeshes) {
    G.scene.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
  carpetMeshes = [];
}

/** One InstancedMesh per variant, GFX_TIERS[tier].carpetTufts instances in total; none in plain mode. */
export function buildCarpet(tier: QualityTier): THREE.InstancedMesh[] {
  clearCarpet();
  const tufts = GFX_TIERS[tier].carpetTufts;
  carpetTufts = tufts;
  if (tufts === 0 || isPlainMode()) return carpetMeshes;
  groundField ??= buildGroundField();
  const grid = Math.floor(Math.sqrt(tufts));
  carpetShared.uCarpetGrid.value = grid;
  carpetShared.uCarpetRadius.value = (grid / 2 - 1) * CARPET_SPACING;
  const perVariant = Math.ceil(tufts / CARPET_VARIANTS.length);
  CARPET_VARIANTS.forEach((variant, v) => {
    const mesh = new THREE.InstancedMesh(buildCarpetTuft(variant, makeRng(CARPET_SEED + v)), carpetMaterial(v, groundField!), perVariant);
    // Placed in the shader: the instance matrices stay identity, so the bounding sphere would sit at the origin.
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData = { carpetVariant: variant };
    G.scene.add(mesh);
    carpetMeshes.push(mesh);
  });
  return carpetMeshes;
}

/** Per frame: the hero's position for the carpet, and a rebuild when the tier's tuft count changes. */
export function updateCarpet(heroX: number, heroZ: number, tier: QualityTier): void {
  if (GFX_TIERS[tier].carpetTufts !== carpetTufts) buildCarpet(tier);
  carpetShared.uHeroXZ.value.set(heroX, heroZ);
}
