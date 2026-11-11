import * as THREE from 'three';
import { COMMON } from '../oilpaint/common.js';
import { inferPaletteId, type PaintClass } from './contract';
import { PALETTE_BY_ID, hexToPaint } from './palettes';

/**
 * The demo's wanderer is a solid painted mesh first. Dabs are only the impasto on top of that
 * body. A mesh drawn as dabs alone reads as a ghost.
 */
const BODY_FRAG = /* glsl */ `
${COMMON}
uniform vec3 uL;
uniform vec3 uM;
uniform vec3 uS;
uniform float uGrain;
in vec3 vWorld;
in vec3 vN;
in vec3 vBind;
layout(location = 0) out vec4 outC;
void main() {
  vec3 Nn = normalize(vN);
  if (!gl_FrontFacing) Nn = -Nn;
  float n = texture(tNoise, vBind.xy * uGrain + vBind.z * 1.7).r;
  float m = texture(tNoise, vBind.yx * uGrain * 0.31 + 0.4).g;
  float lit = sunAt(vWorld + Nn * 0.08) * clamp(dot(Nn, uSunDir) * 0.85 + 0.42, 0.0, 1.0);
  vec3 c = paint3(uL, uM, uS, lit, n);
  c += vec3(0.05, 0.08, 0.04) * max(-Nn.y, 0.0) * (1.0 - lit);
  c = mix(c, c * vec3(0.86, 0.95, 1.08), (1.0 - lit) * max(Nn.y, 0.0) * 0.55);
  c *= 0.88 + 0.24 * m;
  if (!gl_FrontFacing) c *= 0.72;
  outC = vec4(hazed(c, vWorld), 1.0);
}
`;

const VERT = /* glsl */ `
out vec3 vWorld; out vec3 vN; out vec3 vBind;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vBind = position;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const SKIN_VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
out vec3 vWorld; out vec3 vN; out vec3 vBind;
void main() {
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 w = modelMatrix * vec4(transformed, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * objectNormal);
  vBind = position;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

function colorOf(value: THREE.Color): THREE.IUniform {
  return { value };
}

const cache = new Map<string, THREE.ShaderMaterial>();

export function solidMaterial(shared: object, paletteId: string, skinned = false): THREE.ShaderMaterial {
  const key = `${paletteId}:${skinned ? 's' : 'r'}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const palette = PALETTE_BY_ID[paletteId] ?? PALETTE_BY_ID.meadow_grass;
  const mix = (hex: string) => new THREE.Color().setRGB(...hexToPaint(hex), THREE.LinearSRGBColorSpace);
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    side: THREE.DoubleSide,
    uniforms: {
      ...shared as Record<string, THREE.IUniform>,
      uL: colorOf(mix(palette.light)),
      uM: colorOf(mix(palette.half)),
      uS: colorOf(mix(palette.shade)),
      uGrain: { value: 2.2 }
    },
    vertexShader: skinned ? SKIN_VERT : VERT,
    fragmentShader: BODY_FRAG
  });
  mat.userData.oilSolid = true;
  mat.userData.oilPalette = paletteId;
  cache.set(key, mat);
  return mat;
}

/** A colour already on the mesh, when the name does not name a material. */
export function paletteFromColor(hex: number): string {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 0.28 && max - min < 0.16) return 'castle_stone';
  if (g > r + 0.04 && g >= b) return 'foliage';
  if (max - min < 0.14 && max > 0.25) return 'castle_stone';
  if (r > 0.45 && g > 0.3 && b < 0.28 && r > b) return 'timber';
  if (b > r && b > g) return 'kai_tunic';
  if (r > g && g >= b) return 'leather';
  return 'timber';
}

/** A palette we can actually draw. Missing ids and near-black mixes are not. */
export function paletteIsUsable(id: string): boolean {
  const palette = PALETTE_BY_ID[id];
  if (!palette) return false;
  return [palette.light, palette.half, palette.shade].every((hex) => {
    const [r, g, b] = hexToPaint(hex);
    return Math.max(r, g, b) >= 0.04;
  });
}

/**
 * `userData.oilSolid` is not enough. Blender upgrades copy that flag onto a new
 * mesh and leave the original dark Lambert material in place.
 */
export function needsSolidPaint(
  userData: Record<string, unknown> | null | undefined,
  material: { userData?: Record<string, unknown> } | null | undefined
): boolean {
  const ud = userData ?? {};
  if (ud.isOutline || ud.noPaint || ud.isCollider) return false;
  if (ud.wanderer && !ud.gear) return false;
  const want = typeof ud.paint_palette === 'string' ? ud.paint_palette : null;
  if (want && material?.userData?.oilPalette !== want) return true;
  return material?.userData?.oilSolid !== true;
}

export function paletteForMesh(name: string, paintClass: PaintClass, colorHex: number | null): string {
  const named = inferPaletteId(paintClass, null, name);
  const blob = name.toLowerCase();
  const namedByWord = /chicken|feather|leaf|canopy|foliage|spear|sword|scimitar|blade|boot|bracer|leather|trunk|bark|log|timber|plank|wood|rock|stone|castle|wall|cobble|tower|hair|goblin/.test(blob);
  if (namedByWord) return named;
  if (paintClass === 'monster') return named;
  if (paintClass === 'gear') return 'bronze';
  if (paintClass === 'tree') return 'pine_bark';
  if (colorHex != null) return paletteFromColor(colorHex);
  return named;
}

function blocked(obj: THREE.Object3D): boolean {
  if (obj.userData?.gear) return false;
  let p: THREE.Object3D | null = obj;
  while (p) {
    if (p.userData?.noPaint || p.userData?.wanderer || p.userData?.isOutline) return true;
    p = p.parent;
  }
  return false;
}

function meshColor(mesh: THREE.Mesh): number | null {
  const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial | undefined;
  if (material?.color && typeof material.color.getHex === 'function' && !material.userData?.oilSolid) {
    return material.color.getHex();
  }
  return null;
}

/** Opaque paint on every mesh that should read as a body. Outlines are hidden. */
export function dressSolid(root: THREE.Object3D, shared: object, paintClass: PaintClass = 'prop'): number {
  let dressed = 0;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData?.isOutline) {
      mesh.visible = false;
      return;
    }
    if (blocked(mesh) || mesh.userData?.isCollider) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!needsSolidPaint(mesh.userData as Record<string, unknown>, material)) return;
    if (material?.transparent && material.opacity < 0.99) return;
    if (!mesh.geometry.attributes?.normal) mesh.geometry.computeVertexNormals();
    const stamped = typeof mesh.userData?.paint_palette === 'string' ? mesh.userData.paint_palette : null;
    const name = `${mesh.name} ${mesh.parent?.name ?? ''}`;
    let id = stamped && paletteIsUsable(stamped) ? stamped : paletteForMesh(name, paintClass, meshColor(mesh));
    if (!paletteIsUsable(id)) id = 'castle_stone';
    const skinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh === true;
    mesh.material = solidMaterial(shared, id, skinned);
    mesh.userData.oilSolid = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = mesh.userData?.gear || skinned ? false : true;
    dressed += 1;
  });
  return dressed;
}
