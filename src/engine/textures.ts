import * as THREE from 'three';
import { PALETTE, facetMaterial } from './materials';

/** Painted gouache atlases in /public/textures. Phase 1 is albedo only. */
export const ALBEDO_IDS = [
  'grass',
  'dirt',
  'sand',
  'stone',
  'wood',
  'bark',
  'slate',
  'leather',
  'cloth',
  'iron'
] as const;

export type AlbedoId = (typeof ALBEDO_IDS)[number];

/** Species and player identity maps in /public/textures/creatures. */
export const CREATURE_IDS = [
  'skin',
  'hair',
  'eyes',
  'goblin-hide',
  'scorpion-chitin',
  'dragon-scale',
  'moss-bark',
  'demon-hide',
  'giant-fur',
  'chicken-feathers'
] as const;

export type CreatureId = (typeof CREATURE_IDS)[number];

/** Regional ground and rock tiles in /public/textures/biomes. */
export const BIOME_IDS = ['korok-moss', 'peak-volcanic', 'varrock-cobble', 'alkharid-sand'] as const;

export type BiomeId = (typeof BIOME_IDS)[number];

export function biomeAlbedoId(id: BiomeId): string {
  return `biome:${id}`;
}

/** Which painted ground tile wins at a world position. Null keeps the valley blend. */
export function biomeGroundId(x: number, z: number): BiomeId | null {
  if (x > 40 && z > 36) return 'alkharid-sand';
  if (x < -40 && z > 36) return 'peak-volcanic';
  if (x < -40 && z < 0) return 'korok-moss';
  if (Math.hypot(x - 78, z + 20) < 22) return 'varrock-cobble';
  return null;
}

const SPECIES_HIDE: Record<string, CreatureId> = {
  chicken: 'chicken-feathers',
  goblin: 'goblin-hide',
  goblin_archer: 'goblin-hide',
  scorpion: 'scorpion-chitin',
  moss_guardian: 'moss-bark',
  lesser_demon: 'demon-hide',
  hill_giant: 'giant-fur',
  elvarg_dragon: 'dragon-scale'
};

export function creatureAlbedoId(id: CreatureId): string {
  return `creature:${id}`;
}

/** Unique hide/scale/feather albedo for a monster type. Robed humans stay on cloth. */
export function speciesAlbedo(typeKey: string): string | null {
  const id = SPECIES_HIDE[typeKey];
  return id ? creatureAlbedoId(id) : null;
}

/** Three.js Texture.repeat. Ground sits in the brief's 2–4 band, props in 1–2. */
export const GROUND_REPEAT = 3;
export const PROP_REPEAT = 1.5;

/** World meters covered by one painted tile after the repeat above is applied. */
export const GROUND_TILE_METERS = 8;
export const PROP_TILE_METERS = 2;

/** Hexes shared with getBiomeColor so the terrain blend hits the same vertex colors. */
export const BIOME_COLORS = {
  sand: '#e7c27a',
  crag: '#78716c',
  lava: '#f97316',
  canopy: '#16a34a'
} as const;

export interface AlbedoLoader {
  load(url: string): THREE.Texture;
}

const cache = new Map<string, THREE.Texture>();

function fallbackTexture(url: string): THREE.Texture {
  const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  tex.needsUpdate = true;
  tex.name = url;
  return tex;
}

function browserTexture(url: string): THREE.Texture {
  const tex = new THREE.TextureLoader().load(url);
  tex.name = url;
  return tex;
}

const defaultLoader: AlbedoLoader = {
  load(url: string) {
    if (typeof document === 'undefined') return fallbackTexture(url);
    return browserTexture(url);
  }
};

export function albedoUrl(id: string): string {
  if (id.startsWith('creature:')) return `/textures/creatures/${id.slice('creature:'.length)}.png`;
  if (id.startsWith('gear:')) return `/textures/gear/${id.slice('gear:'.length)}.png`;
  if (id.startsWith('biome:')) return `/textures/biomes/${id.slice('biome:'.length)}.png`;
  return `/textures/${id}.png`;
}

export function loadAlbedo(id: string, repeat = PROP_REPEAT, loader?: AlbedoLoader): THREE.Texture {
  const key = `${id}:${repeat}`;
  if (!loader) {
    const cached = cache.get(key);
    if (cached) return cached;
  }
  const url = albedoUrl(id);
  const tex = (loader ?? defaultLoader).load(url);
  tex.name = url;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(repeat, repeat);
  if (!loader) cache.set(key, tex);
  return tex;
}

/** Material-tier tiles in /public/textures/gear. Trims and gems stay flat. */
export const GEAR_IDS = [
  'bronze',
  'iron',
  'steel',
  'mithril',
  'adamant',
  'rune',
  'wood',
  'hide',
  'leather',
  'cloth'
] as const;

export type GearId = (typeof GEAR_IDS)[number];

const TIER_GEAR: Record<string, GearId> = {
  bronze: 'bronze',
  iron: 'iron',
  steel: 'steel',
  black: 'steel',
  white: 'steel',
  mithril: 'mithril',
  adamant: 'adamant',
  rune: 'rune',
  gilded: 'rune',
  dragon: 'rune',
  barrows: 'rune',
  bandos: 'rune',
  raids: 'rune',
  botw: 'rune'
};

export function gearAlbedoId(id: GearId): string {
  return `gear:${id}`;
}

function tierGear(tier: string | undefined): GearId {
  return (tier && TIER_GEAR[tier]) || 'iron';
}

/**
 * Gear tile for a worn item. The material color stays the item token; the map only tints it.
 * Gold trim, gems, and skin stay untextured. Higher metals share the rune tile and keep their token.
 */
export function albedoForItem(
  item: { id?: string; iconKind?: string; slot?: string; tier?: string } | null | undefined
): string | null {
  const gear = gearFamily(item);
  return gear ? gearAlbedoId(gear) : null;
}

export function gearFamily(
  item: { id?: string; iconKind?: string; slot?: string; tier?: string } | null | undefined
): GearId | null {
  if (!item) return null;
  const id = item.id || '';
  const kind = item.iconKind || '';
  const slot = item.slot || '';
  if (id === 'wooden_shield') return 'wood';
  if (kind === 'bow' || kind === 'staff' || kind === 'wand') return 'wood';
  if (kind === 'whip' || kind.startsWith('dhide') || id.includes('dhide')) return 'hide';
  if (['tunic', 'trousers', 'robe_top', 'robe_bottom', 'cape', 'hat', 'hood'].includes(kind) || slot === 'cape') {
    return 'cloth';
  }
  if (slot === 'feet') {
    if (id.includes('mystic') || id.includes('eternal')) return 'cloth';
    if (id.includes('leather') || id.includes('ranger') || id.includes('pegasian') || id.includes('primordial')) return 'leather';
    return tierGear(item.tier);
  }
  if (slot === 'hands') {
    if (id.includes('mystic')) return 'cloth';
    if (id.includes('leather') || id.includes('barrows')) return 'leather';
    return tierGear(item.tier);
  }
  if (['scimitar', 'sword', 'greatsword', 'mace', 'greataxe', 'crossbow', 'body', 'legs', 'head'].includes(kind)) {
    return tierGear(item.tier);
  }
  if (slot === 'shield' || slot === 'body' || slot === 'legs' || slot === 'weapon' || slot === 'head') return tierGear(item.tier);
  if (slot === 'neck' || slot === 'ring') return tierGear(item.tier);
  return null;
}

export function albedoMaterial(
  color: number,
  id: string | null,
  extra: Record<string, unknown> = {}
): THREE.MeshLambertMaterial {
  const mat = facetMaterial({
    color,
    ...extra,
    ...(id ? { map: loadAlbedo(id, PROP_REPEAT) } : {})
  });
  if (id) mat.userData.albedoId = id;
  return mat;
}

export function applyAlbedo(material: THREE.MeshLambertMaterial, id: string | null): void {
  const next = id ? loadAlbedo(id, PROP_REPEAT) : null;
  if (material.map !== next) {
    material.map = next;
    material.needsUpdate = true;
  }
  material.userData.albedoId = id;
  if (id) material.userData.albedoSpace = 'prop';
  else delete material.userData.albedoSpace;
}

/**
 * Project UVs from face direction so a tile covers `metersPerTile` world units
 * once Texture.repeat is applied. Small props are scaled up to at least `minSpan`
 * UV units so the repeat still reads.
 */
export function assignProjectedUvs(
  geometry: THREE.BufferGeometry,
  metersPerTile: number,
  textureRepeat: number,
  minSpan = 1
): void {
  if (geometry.userData.albedoUv) return;
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos) return;
  let uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!uv) {
    uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    geometry.setAttribute('uv', uv);
  }
  if (!geometry.getAttribute('normal')) {
    geometry.computeVertexNormals();
  }
  const norm = geometry.getAttribute('normal') as THREE.BufferAttribute;
  const divisor = metersPerTile * textureRepeat;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    const weight = Math.max(nx + ny + nz, 1e-5);
    const u = (ny * x + nx * z + nz * x) / (weight * divisor);
    const v = (ny * z + nx * y + nz * y) / (weight * divisor);
    uv.setXY(i, u, v);
  }
  if (minSpan > 0) {
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (let i = 0; i < uv.count; i++) {
      minU = Math.min(minU, uv.getX(i));
      maxU = Math.max(maxU, uv.getX(i));
      minV = Math.min(minV, uv.getY(i));
      maxV = Math.max(maxV, uv.getY(i));
    }
    const spanU = Math.max(maxU - minU, 1e-5);
    const spanV = Math.max(maxV - minV, 1e-5);
    const scaleU = spanU < minSpan ? minSpan / spanU : 1;
    const scaleV = spanV < minSpan ? minSpan / spanV : 1;
    if (scaleU !== 1 || scaleV !== 1) {
      const midU = (minU + maxU) / 2;
      const midV = (minV + maxV) / 2;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, midU + (uv.getX(i) - midU) * scaleU, midV + (uv.getY(i) - midV) * scaleV);
      }
    }
  }
  stitchUvWraps(geometry, metersPerTile);
  uv.needsUpdate = true;
  geometry.userData.albedoUv = true;
}

/**
 * Close a wrap seam on a short edge. Large faces keep their span so a wall still tiles.
 */
function stitchUvWraps(geometry: THREE.BufferGeometry, metersPerTile: number): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos) return;
  let uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!uv) {
    uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    geometry.setAttribute('uv', uv);
  }
  const index = geometry.getIndex();
  const triCount = index ? index.count / 3 : Math.floor(pos.count / 3);
  const at = (n: number) => (index ? index.getX(n) : n);
  const limit = metersPerTile * 0.65;
  for (let t = 0; t < triCount; t++) {
    const ids = [at(t * 3), at(t * 3 + 1), at(t * 3 + 2)];
    const anchor = ids[0];
    for (const i of ids.slice(1)) {
      const dist = Math.hypot(
        pos.getX(i) - pos.getX(anchor),
        pos.getY(i) - pos.getY(anchor),
        pos.getZ(i) - pos.getZ(anchor)
      );
      if (dist > limit) continue;
      const du = uv.getX(i) - uv.getX(anchor);
      const dv = uv.getY(i) - uv.getY(anchor);
      if (Math.abs(du) > 0.5) uv.setX(i, uv.getX(i) - Math.round(du));
      if (Math.abs(dv) > 0.5) uv.setY(i, uv.getY(i) - Math.round(dv));
    }
  }
}

/** Slide a creature's albedo so two of the same species do not share one stamp. */
export function offsetAlbedoPhase(root: THREE.Object3D, phaseU: number, phaseV: number): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const material = mesh.material as THREE.MeshLambertMaterial | undefined;
    const id = material?.userData?.albedoId;
    if (typeof id !== 'string' || !id.startsWith('creature:')) return;
    const uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
    if (!uv) return;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) + phaseU, uv.getY(i) + phaseV);
    }
    uv.needsUpdate = true;
    mesh.geometry.userData.albedoPhase = [phaseU, phaseV];
  });
}

/** Ground UVs follow world XZ so hills do not flip to a side projection. */
export function assignGroundUvs(geometry: THREE.BufferGeometry): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos) return;
  let uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!uv) {
    uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
    geometry.setAttribute('uv', uv);
  }
  const divisor = GROUND_TILE_METERS * GROUND_REPEAT;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, pos.getX(i) / divisor, pos.getZ(i) / divisor);
  }
  uv.needsUpdate = true;
  geometry.userData.albedoUv = true;
}

export function sealAlbedoUvs(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const mat = mesh.material as THREE.MeshLambertMaterial | THREE.MeshLambertMaterial[] | undefined;
    if (!mat || Array.isArray(mat) || mat.userData?.albedoSpace !== 'prop') return;
    assignProjectedUvs(mesh.geometry, PROP_TILE_METERS, PROP_REPEAT, 1);
  });
}

const TERRAIN_PARS = `
#include <map_pars_fragment>
uniform sampler2D uDirtMap;
uniform sampler2D uSandMap;
uniform sampler2D uStoneMap;
uniform sampler2D uKorokMap;
uniform sampler2D uVolcanicMap;
uniform sampler2D uCobbleMap;
uniform sampler2D uCrackedSandMap;
uniform float uMetersPerTile;
uniform vec3 uSage;
uniform vec3 uSageLit;
uniform vec3 uSageShade;
uniform vec3 uCanopy;
uniform vec3 uDirt;
uniform vec3 uSand;
uniform vec3 uCrag;
float biomeWeight(vec3 sampleColor, vec3 target) {
  vec3 delta = sampleColor - target;
  return exp(-90.0 * dot(delta, delta));
}
`;

const TERRAIN_SAMPLE = `
vec3 grassTex = texture2D( map, vMapUv ).rgb;
vec3 dirtTex = texture2D( uDirtMap, vMapUv ).rgb;
vec3 sandTex = texture2D( uSandMap, vMapUv ).rgb;
vec3 stoneTex = texture2D( uStoneMap, vMapUv ).rgb;
vec3 biomeColor = vColor.rgb;
float grassW = max(max(biomeWeight(biomeColor, uSage), biomeWeight(biomeColor, uSageLit)), max(biomeWeight(biomeColor, uSageShade), biomeWeight(biomeColor, uCanopy)));
float dirtW = biomeWeight(biomeColor, uDirt);
float sandW = biomeWeight(biomeColor, uSand);
float stoneW = biomeWeight(biomeColor, uCrag);
float weightSum = grassW + dirtW + sandW + stoneW;
if (weightSum < 0.2) {
  float warm = vColor.r - max(vColor.g, vColor.b);
  if (warm > 0.08) dirtW = 1.0;
  else stoneW = 1.0;
  weightSum = grassW + dirtW + sandW + stoneW;
}
vec3 albedoTex = (grassTex * grassW + dirtTex * dirtW + sandTex * sandW + stoneTex * stoneW) / max(weightSum, 0.0001);
vec2 worldXZ = vMapUv * uMetersPerTile;
float desertBiome = smoothstep(32.0, 46.0, worldXZ.y) * smoothstep(32.0, 48.0, worldXZ.x);
float peakBiome = smoothstep(28.0, 42.0, worldXZ.y) * smoothstep(-32.0, -46.0, worldXZ.x);
float korokBiome = smoothstep(-4.0, -18.0, worldXZ.y) * smoothstep(-32.0, -46.0, worldXZ.x);
float plazaBiome = 1.0 - smoothstep(12.0, 22.0, distance(worldXZ, vec2(78.0, -20.0)));
albedoTex = mix(albedoTex, texture2D(uKorokMap, vMapUv).rgb, korokBiome);
albedoTex = mix(albedoTex, texture2D(uVolcanicMap, vMapUv).rgb, peakBiome);
albedoTex = mix(albedoTex, texture2D(uCrackedSandMap, vMapUv).rgb, desertBiome);
albedoTex = mix(albedoTex, texture2D(uCobbleMap, vMapUv).rgb, plazaBiome);
diffuseColor *= vec4(albedoTex, 1.0);
`;

export function terrainMaterial(loader?: AlbedoLoader): THREE.MeshLambertMaterial {
  const grass = loadAlbedo('grass', GROUND_REPEAT, loader);
  const dirt = loadAlbedo('dirt', GROUND_REPEAT, loader);
  const sand = loadAlbedo('sand', GROUND_REPEAT, loader);
  const stone = loadAlbedo('stone', GROUND_REPEAT, loader);
  const korok = loadAlbedo(biomeAlbedoId('korok-moss'), GROUND_REPEAT, loader);
  const volcanic = loadAlbedo(biomeAlbedoId('peak-volcanic'), GROUND_REPEAT, loader);
  const cobble = loadAlbedo(biomeAlbedoId('varrock-cobble'), GROUND_REPEAT, loader);
  const cracked = loadAlbedo(biomeAlbedoId('alkharid-sand'), GROUND_REPEAT, loader);
  const mat = facetMaterial({ vertexColors: true, map: grass });
  mat.userData.albedoSpace = 'ground';
  const previous = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.uDirtMap = { value: dirt };
    shader.uniforms.uSandMap = { value: sand };
    shader.uniforms.uStoneMap = { value: stone };
    shader.uniforms.uKorokMap = { value: korok };
    shader.uniforms.uVolcanicMap = { value: volcanic };
    shader.uniforms.uCobbleMap = { value: cobble };
    shader.uniforms.uCrackedSandMap = { value: cracked };
    shader.uniforms.uMetersPerTile = { value: GROUND_TILE_METERS };
    shader.uniforms.uSage = { value: new THREE.Color(PALETTE.sage) };
    shader.uniforms.uSageLit = { value: new THREE.Color(PALETTE.sageLit) };
    shader.uniforms.uSageShade = { value: new THREE.Color(PALETTE.sageShade) };
    shader.uniforms.uCanopy = { value: new THREE.Color(BIOME_COLORS.canopy) };
    shader.uniforms.uDirt = { value: new THREE.Color(PALETTE.dirt) };
    shader.uniforms.uSand = { value: new THREE.Color(BIOME_COLORS.sand) };
    shader.uniforms.uCrag = { value: new THREE.Color(BIOME_COLORS.crag) };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', TERRAIN_PARS)
      .replace('#include <map_fragment>', TERRAIN_SAMPLE);
  };
  return mat;
}
